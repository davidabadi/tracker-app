import { useHttp } from '@inertiajs/react';
import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { ShowWatchRow } from '@/components/show-watch-row';
import type { ShowWatchRowData } from '@/components/show-watch-row';
import { Spinner } from '@/components/ui/spinner';
import { watchedHistory } from '@/routes/shows';

type HistoryResponse = {
    rows: ShowWatchRowData[];
    nextCursor: string | null;
    hasMore: boolean;
};

export type WatchedHistoryHandle = {
    /** Add a just-watched episode to the bottom (newest) of the history. */
    recordWatch: (row: ShowWatchRowData) => void;
};

// Fire the next (older) page once the user scrolls within this many px of the top.
const LOAD_AT = 8;

/**
 * Watched History (spec Part 2 §3), sitting above Watch Next / Haven't Started:
 * this user's watched episodes, dimmed, most-recent nearest Watch Next and older
 * entries further up — a chat-log that pages older content upward.
 *
 * The first page is loaded eagerly on mount but parked off-screen above Watch
 * Next, so the initial view is Watch Next and the first scroll-up reveals ready
 * rows with no spinner; the spinner only appears once the user pages past that
 * first batch. Older pages prepend with scroll-anchoring so the content under the
 * user's eyes stays put. `recordWatch` appends a freshly-watched episode live at
 * the bottom without waiting for a reload. Reuses the shared row component.
 */
export const WatchedHistory = forwardRef<
    WatchedHistoryHandle,
    {
        scrollRef: React.RefObject<HTMLDivElement | null>;
        onOpenShow: (row: ShowWatchRowData) => void;
        onOpenEpisode: (episodeId: number) => void;
    }
>(function WatchedHistory({ scrollRef, onOpenShow, onOpenEpisode }, ref) {
    const [rows, setRows] = useState<ShowWatchRowData[]>([]);
    const [loading, setLoading] = useState(false);

    const { get } = useHttp({});

    const cursor = useRef<string | null>(null);
    const hasMore = useRef(true);
    const loadingLock = useRef(false);
    const initialised = useRef(false);
    // scrollHeight captured just before content is added above the fold, to
    // compensate scrollTop after and keep the viewport visually still.
    const anchor = useRef<number | null>(null);

    const loadOlder = useCallback(() => {
        if (loadingLock.current || !hasMore.current) {
            return;
        }

        loadingLock.current = true;
        setLoading(true);

        const query = cursor.current ? { cursor: cursor.current } : {};

        get(watchedHistory.url({ query }), {
            onSuccess: (response) => {
                const payload = response as HistoryResponse;
                const element = scrollRef.current;

                anchor.current = element ? element.scrollHeight : null;

                // Server sends newest-first; reverse so the batch reads
                // oldest→newest top-to-bottom, then prepend older-than-loaded.
                setRows((previous) => [
                    ...[...payload.rows].reverse(),
                    ...previous,
                ]);
                cursor.current = payload.nextCursor;
                hasMore.current = payload.hasMore;
            },
            onError: () => {
                hasMore.current = false;
            },
            onFinish: () => {
                loadingLock.current = false;
                setLoading(false);
            },
        });
    }, [get, scrollRef]);

    // Eager first batch on mount (item 3). Passive effect so the ancestor
    // scroller ref is attached; the first prepend's scroll-anchoring (below)
    // parks Watch Next at the top, leaving the batch off-screen above.
    useEffect(() => {
        if (initialised.current) {
            return;
        }

        initialised.current = true;
        loadOlder();
    }, [loadOlder]);

    // Compensate scrollTop for content added above the viewport — older pages
    // prepended at the top, and (via recordWatch) a new row appended at the
    // bottom of history, which still sits above the Watch-Next fold.
    useLayoutEffect(() => {
        const element = scrollRef.current;

        if (element && anchor.current !== null) {
            element.scrollTop += element.scrollHeight - anchor.current;
            anchor.current = null;
        }
    }, [rows, scrollRef]);

    useEffect(() => {
        const element = scrollRef.current;

        if (!element) {
            return;
        }

        function onScroll() {
            if (element!.scrollTop <= LOAD_AT) {
                loadOlder();
            }
        }

        element.addEventListener('scroll', onScroll, { passive: true });

        return () => element.removeEventListener('scroll', onScroll);
    }, [scrollRef, loadOlder]);

    useImperativeHandle(
        ref,
        () => ({
            recordWatch: (row) => {
                const episode = row.episode;

                if (!episode) {
                    return;
                }

                const element = scrollRef.current;
                // The new row lands at the bottom of history, just above the
                // fold — anchor so it doesn't nudge Watch Next down.
                anchor.current = element ? element.scrollHeight : null;

                const historyRow: ShowWatchRowData = {
                    ...row,
                    section: 'watched_history',
                    status: null,
                    has_progress: true,
                    remaining: 0,
                    badge: null,
                    next_episode: null,
                    last_watched_at: new Date().toISOString(),
                    episode: {
                        ...episode,
                        watch_count: Math.max(1, episode.watch_count),
                    },
                };

                // A rewatch of an already-listed episode moves to the bottom.
                setRows((previous) => [
                    ...previous.filter(
                        (item) => item.episode?.id !== episode.id,
                    ),
                    historyRow,
                ]);
            },
        }),
        [scrollRef],
    );

    if (rows.length === 0) {
        return null;
    }

    return (
        <div style={{ overflowAnchor: 'none' }}>
            {/* Pill pinned to the top of the viewport while any history is in
                view; scrolls away only once Watch Next reaches the top (item 4).
                Solid background so the dimmed rows read cleanly beneath it. */}
            <div className="sticky top-0 z-10 bg-background pt-1 pb-3">
                <div className="flex justify-center">
                    <span className="rounded-full bg-muted px-3.5 py-1 text-xs font-semibold tracking-wider uppercase">
                        Watched History
                    </span>
                </div>
            </div>

            {/* Spinner shows only when paging older (never the eager first
                batch, which loads while rows is still empty). */}
            {loading && (
                <div className="flex justify-center pb-3">
                    <Spinner className="size-5 text-muted-foreground" />
                </div>
            )}

            <ul className="space-y-3 opacity-45">
                {rows.map((row) => (
                    <ShowWatchRow
                        key={`history-${row.episode?.id ?? row.show_id}`}
                        row={row}
                        onOpenShow={() => onOpenShow(row)}
                        onOpenEpisode={onOpenEpisode}
                    />
                ))}
            </ul>

            <div className="h-6" />
        </div>
    );
});
