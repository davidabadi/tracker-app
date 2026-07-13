import { Head, router, useHttp } from '@inertiajs/react';
import { Check, EyeOff, Tv } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toggle as toggleEpisode } from '@/actions/App/Http/Controllers/EpisodeWatchController';
import {
    removeFromList,
    setStatus,
} from '@/actions/App/Http/Controllers/ShowTrackingController';
import { EmptyState } from '@/components/empty-state';
import { EpisodeQuickViewModal } from '@/components/episode-quick-view-modal';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import { PageScrollArea } from '@/components/page-scroll-area';
import { ShowDetailModal } from '@/components/show-detail-modal';
import { ShowStatusSheet } from '@/components/show-status-sheet';
import type { StatusAction } from '@/components/show-status-sheet';
import { ShowWatchRow } from '@/components/show-watch-row';
import type { ShowWatchRowData } from '@/components/show-watch-row';
import { WatchedHistory } from '@/components/watched-history';
import type { WatchedHistoryHandle } from '@/components/watched-history';
import type { WatchAction } from '@/components/watched-toggle';
import { hasAired } from '@/lib/media';
import { cn } from '@/lib/utils';
import { shows } from '@/routes';
import { upcoming } from '@/routes/shows';

/**
 * FLIP: after each render, animate every tracked row from where it was in the
 * previous committed layout to where it is now. This is what makes a show
 * gliding to the top of Watch Next (or the list closing up after one is removed)
 * read as a smooth transition rather than a jump. Returns a ref registrar keyed
 * by show id.
 */
function useFlip() {
    const nodes = useRef(new Map<number, HTMLLIElement>());
    const prevRects = useRef(new Map<number, DOMRect>());

    useLayoutEffect(() => {
        const next = new Map<number, DOMRect>();

        nodes.current.forEach((node, id) => {
            if (node) {
                next.set(id, node.getBoundingClientRect());
            }
        });

        next.forEach((rect, id) => {
            const prev = prevRects.current.get(id);

            if (!prev) {
                return;
            }

            const dx = prev.left - rect.left;
            const dy = prev.top - rect.top;

            if (dx || dy) {
                nodes.current
                    .get(id)
                    ?.animate(
                        [
                            { transform: `translate(${dx}px, ${dy}px)` },
                            { transform: 'translate(0, 0)' },
                        ],
                        {
                            duration: 360,
                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        },
                    );
            }
        });

        prevRects.current = next;
    });

    return (id: number) => (node: HTMLLIElement | null) => {
        if (node) {
            nodes.current.set(id, node);
        } else {
            nodes.current.delete(id);
        }
    };
}

/**
 * A titled section of show rows ("Watch Next", "Haven't Started", "Watch
 * Later"), omitted entirely when it has nothing in it.
 */
function Section({
    label,
    rows,
    render,
}: {
    label: string;
    rows: ShowWatchRowData[];
    render: (row: ShowWatchRowData) => React.ReactNode;
}) {
    if (rows.length === 0) {
        return null;
    }

    return (
        <section>
            <div className="flex justify-center">
                <span className="rounded-full bg-muted px-3.5 py-1 text-xs font-semibold tracking-wider uppercase">
                    {label}
                </span>
            </div>
            <ul className="mt-3 space-y-3">{rows.map(render)}</ul>
        </section>
    );
}

export default function Shows({
    watchNext,
    haventStarted,
    watchLaterCount,
    watchLater,
}: {
    watchNext: ShowWatchRowData[];
    haventStarted: ShowWatchRowData[];
    watchLaterCount: number;
    // Optional prop: only present after the inline Watch Later section is revealed.
    watchLater?: ShowWatchRowData[];
}) {
    const [episodeModalId, setEpisodeModalId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState<{
        showId: number;
        title: string;
    } | null>(null);
    // The row whose left-swipe status dialog is open, if any.
    const [statusRow, setStatusRow] = useState<ShowWatchRowData | null>(null);
    const [statusCovering, setStatusCovering] = useState<{
        id: number;
        start: number;
    } | null>(null);

    const scrollRef = useRef<HTMLDivElement | null>(null);
    const historyRef = useRef<WatchedHistoryHandle | null>(null);

    // Rows are held locally so a mark-watched can reorder/remove them with a
    // transition before the authoritative server data reloads in.
    const [rows, setRows] = useState<ShowWatchRowData[]>(() => [
        ...watchNext,
        ...haventStarted,
    ]);
    const [markingId, setMarkingId] = useState<number | null>(null);
    const [coveringSweep, setCoveringSweep] = useState<{
        id: number;
        start: number;
    } | null>(null);
    const [revealingId, setRevealingId] = useState<number | null>(null);
    const [collapsingId, setCollapsingId] = useState<number | null>(null);

    // The inline Watch Later section (revealed by the button, spec item 2).
    const [showWatchLater, setShowWatchLater] = useState(false);
    const [watchLaterRows, setWatchLaterRows] = useState<ShowWatchRowData[]>(
        [],
    );
    // Mirrored so reloadList (called from timeouts/callbacks) always includes the
    // Watch Later prop once the section is revealed.
    const showWatchLaterRef = useRef(false);

    useEffect(() => {
        showWatchLaterRef.current = showWatchLater;
    }, [showWatchLater]);

    const flipRef = useFlip();
    const { patch } = useHttp({ action: 'increment' as WatchAction });
    const watchLaterHttp = useHttp({ action: 'increment' as WatchAction });
    const statusHttp = useHttp({ status: '' });
    const removeHttp = useHttp({});

    // Resync with the server whenever fresh Watch List data arrives (reloads) —
    // the "adjust state during render" pattern rather than an effect, so the new
    // rows are in place before the FLIP layout effect measures them. While a
    // mark-watched animation is running (markingId set) the sequence drives
    // `rows` by hand, so the blanket resync stands down until it finishes.
    const [syncedProps, setSyncedProps] = useState({
        watchNext,
        haventStarted,
    });

    if (
        (syncedProps.watchNext !== watchNext ||
            syncedProps.haventStarted !== haventStarted) &&
        markingId === null
    ) {
        setSyncedProps({ watchNext, haventStarted });
        setRows([...watchNext, ...haventStarted]);
    }

    // The optional Watch Later prop only arrives once requested; mirror it into
    // local state so swipes can mutate the section before a reload lands.
    const [syncedWatchLater, setSyncedWatchLater] = useState(watchLater);

    if (watchLater !== undefined && watchLater !== syncedWatchLater) {
        setSyncedWatchLater(watchLater);
        setWatchLaterRows(watchLater);
    }

    const watchNextRows = rows.filter((row) => row.section === 'watch_next');
    const haventStartedRows = rows.filter(
        (row) => row.section === 'havent_started',
    );

    const hasWatchLaterSection = showWatchLater && watchLaterRows.length > 0;
    const showEmpty =
        rows.length === 0 && !hasWatchLaterSection && watchLaterCount === 0;

    function finishAnim() {
        setMarkingId(null);
        setCoveringSweep(null);
        setRevealingId(null);
        setCollapsingId(null);
    }

    function reloadList(onFinish?: () => void) {
        const only = ['watchNext', 'haventStarted', 'watchLaterCount'];

        if (showWatchLaterRef.current) {
            only.push('watchLater');
        }

        router.reload({ only, onFinish });
    }

    function revealWatchLater() {
        setShowWatchLater(true);
        router.reload({ only: ['watchLater'] });
    }

    /**
     * Apply a left-swipe status action (spec Part 2 §2) to a show in either the
     * watching lists or the Watch Later section. Every option moves the show out
     * of its current list, so the row is dropped optimistically from both and
     * reconciled on finish (a reload fired alongside the mutation can race ahead
     * of the DB commit and re-add the row). "Remove" deletes the tracking row
     * only — the endpoint never touches watch history.
     */
    function applyStatusAction(row: ShowWatchRowData, action: StatusAction) {
        setStatusRow(null);
        router.flushAll();

        setRows((current) =>
            current.filter((item) => item.show_id !== row.show_id),
        );
        setWatchLaterRows((current) =>
            current.filter((item) => item.show_id !== row.show_id),
        );

        if (action === 'remove') {
            removeHttp.delete(removeFromList.url(row.show_id), {
                onFinish: () => reloadList(),
            });
        } else {
            const status = action === 'watch_later' ? 'watch_later' : 'stopped';

            statusHttp.transform(() => ({ status }));
            statusHttp.patch(setStatus.url(row.show_id), {
                onFinish: () => reloadList(),
            });
        }
    }

    /**
     * Right-swipe on a Watch Later row: mark its surfaced (aired) episode watched
     * in place. The watch auto-promotes the show to Watching (it moves to Watch
     * Next on reload); optimistically bump the count, log the episode to Watched
     * History live, then reconcile.
     */
    function incrementWatchLaterRow(row: ShowWatchRowData) {
        const episode = row.episode;

        if (!episode || !hasAired(episode)) {
            return;
        }

        router.flushAll();
        setWatchLaterRows((current) =>
            current.map((item) =>
                item.show_id === row.show_id && item.episode
                    ? {
                          ...item,
                          episode: {
                              ...item.episode,
                              watch_count: item.episode.watch_count + 1,
                          },
                      }
                    : item,
            ),
        );
        historyRef.current?.recordWatch(row);

        watchLaterHttp.transform(() => ({ action: 'increment' }));
        watchLaterHttp.patch(toggleEpisode.url(episode.id), {
            onFinish: () => reloadList(),
        });
    }

    /**
     * Mark a watching row's surfaced episode watched. The episode is logged to
     * Watched History immediately (item 5); then the same green sweep plays, and
     * either the row fades out (last episode) or the next episode is revealed in
     * place and the row glides to the top of Watch Next (FLIP). Visuals are
     * optimistic; a background reload reconciles order/badges when it ends.
     */
    function markWatched(row: ShowWatchRowData, sweepStart = 0) {
        if (markingId !== null || !row.episode) {
            return;
        }

        setMarkingId(row.show_id);
        setCoveringSweep({ id: row.show_id, start: sweepStart });
        router.flushAll();
        historyRef.current?.recordWatch(row);

        const isLast = row.remaining === 0;

        patch(toggleEpisode.url(row.episode.id), {
            onError: () => {
                finishAnim();
                reloadList();
            },
        });
        reloadList();

        if (isLast) {
            window.setTimeout(() => setCollapsingId(row.show_id), 720);
            window.setTimeout(() => {
                setRows((current) =>
                    current.filter((item) => item.show_id !== row.show_id),
                );
                finishAnim();
            }, 1040);

            return;
        }

        window.setTimeout(() => {
            setRows((current) =>
                current.map((item) =>
                    item.show_id === row.show_id
                        ? {
                              ...item,
                              episode: row.next_episode,
                              next_episode: null,
                              remaining: Math.max(0, item.remaining - 1),
                              badge: null,
                          }
                        : item,
                ),
            );
        }, 500);

        window.setTimeout(() => setRevealingId(row.show_id), 640);

        window.setTimeout(() => {
            setRows((current) => {
                const moved = current.find(
                    (item) => item.show_id === row.show_id,
                );

                if (!moved) {
                    return current;
                }

                const rest = current.filter(
                    (item) => item.show_id !== row.show_id,
                );

                return [{ ...moved, section: 'watch_next' }, ...rest];
            });
            finishAnim();
        }, 1040);
    }

    function openShow(row: ShowWatchRowData) {
        setShowModal({
            showId: row.show_id,
            title: row.show_title ?? 'Show',
        });
    }

    function handleModalClose(dirty: boolean) {
        setEpisodeModalId(null);
        setShowModal(null);

        if (dirty) {
            reloadList();
        }
    }

    function openStatusMenu(row: ShowWatchRowData, sweepStart: number) {
        if (statusCovering !== null) {
            return;
        }

        setStatusCovering({ id: row.show_id, start: sweepStart });
    }

    function statusSweep(row: ShowWatchRowData) {
        return statusCovering?.id === row.show_id ? (
            <div
                aria-hidden
                style={
                    {
                        '--sweep-start': statusCovering.start,
                    } as CSSProperties
                }
                onAnimationEnd={() => {
                    setStatusCovering(null);
                    setStatusRow(row);
                }}
                className="animate-status-sweep absolute inset-0 z-10 flex items-center justify-center bg-blue-500"
            >
                <EyeOff className="size-7 text-white" strokeWidth={2.5} />
            </div>
        ) : undefined;
    }

    function renderRow(row: ShowWatchRowData) {
        return (
            <ShowWatchRow
                key={row.show_id}
                row={row}
                innerRef={flipRef(row.show_id)}
                marking={markingId === row.show_id}
                className={
                    collapsingId === row.show_id
                        ? 'scale-[0.98] opacity-0 transition-all duration-300'
                        : undefined
                }
                overlay={
                    coveringSweep?.id === row.show_id ? (
                        <div
                            style={
                                {
                                    '--sweep-start': coveringSweep.start,
                                } as CSSProperties
                            }
                            className={cn(
                                'animate-watch-sweep absolute inset-0 z-10 flex items-center justify-center bg-emerald-500',
                                revealingId === row.show_id &&
                                    'opacity-0 transition-opacity duration-300',
                            )}
                        >
                            <Check
                                className="size-7 text-white"
                                strokeWidth={2.5}
                            />
                        </div>
                    ) : (
                        statusSweep(row)
                    )
                }
                onMarkWatched={() => markWatched(row)}
                onOpenShow={() => openShow(row)}
                onOpenEpisode={setEpisodeModalId}
                swipe={{
                    onSwipeRight: (progress) => markWatched(row, progress),
                    rightEnabled: hasAired(row.episode),
                    onSwipeLeft: (progress) => openStatusMenu(row, progress),
                }}
            />
        );
    }

    function renderWatchLaterRow(row: ShowWatchRowData) {
        return (
            <ShowWatchRow
                key={row.show_id}
                row={row}
                overlay={statusSweep(row)}
                onOpenShow={() => openShow(row)}
                onOpenEpisode={setEpisodeModalId}
                swipe={{
                    onSwipeRight: () => incrementWatchLaterRow(row),
                    rightEnabled: hasAired(row.episode),
                    onSwipeLeft: (progress) => openStatusMenu(row, progress),
                }}
            />
        );
    }

    return (
        <>
            <Head title="Shows" />
            <Heading
                title="Shows"
                description="What you're watching and what's next."
            />
            <MediaSubTabs
                tabs={[
                    { title: 'Watch List', href: shows() },
                    { title: 'Upcoming', href: upcoming() },
                ]}
            />
            <PageScrollArea
                scrollRef={scrollRef}
                className="[overflow-anchor:none]"
            >
                <WatchedHistory
                    ref={historyRef}
                    scrollRef={scrollRef}
                    onOpenShow={openShow}
                    onOpenEpisode={setEpisodeModalId}
                    onEpisodeUnwatched={() => reloadList()}
                />

                {/* Watch Next / Haven't Started / Watch Later fill at least the
                    viewport, so the history above always parks off-screen. */}
                <div className="min-h-full">
                    {showEmpty ? (
                        <EmptyState
                            icon={Tv}
                            title="Nothing to watch yet"
                            description="Track a show from Search and start marking episodes watched — your next episodes show up here."
                        />
                    ) : (
                        <div className="space-y-6">
                            <Section
                                label="Watch Next"
                                rows={watchNextRows}
                                render={renderRow}
                            />
                            <Section
                                label="Haven't Started"
                                rows={haventStartedRows}
                                render={renderRow}
                            />
                            {hasWatchLaterSection && (
                                <Section
                                    label="Watch Later"
                                    rows={watchLaterRows}
                                    render={renderWatchLaterRow}
                                />
                            )}
                        </div>
                    )}

                    {!showWatchLater && watchLaterCount > 0 && (
                        <div className="mt-6 flex justify-center">
                            <button
                                type="button"
                                onClick={revealWatchLater}
                                className="inline-flex items-center rounded-full border border-foreground/25 px-6 py-2.5 text-sm font-semibold tracking-wide uppercase transition-colors hover:border-foreground/60"
                            >
                                See Watch Later Shows
                            </button>
                        </div>
                    )}
                </div>
            </PageScrollArea>

            {episodeModalId !== null && (
                <EpisodeQuickViewModal
                    episodeId={episodeModalId}
                    onClose={handleModalClose}
                />
            )}
            {showModal !== null && (
                <ShowDetailModal
                    showId={showModal.showId}
                    title={showModal.title}
                    onClose={handleModalClose}
                />
            )}

            <ShowStatusSheet
                open={statusRow !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setStatusRow(null);
                    }
                }}
                showTitle={statusRow?.show_title ?? 'Show'}
                status={statusRow?.status ?? null}
                hasProgress={statusRow?.has_progress ?? false}
                onAction={(action) => {
                    if (statusRow) {
                        applyStatusAction(statusRow, action);
                    }
                }}
            />
        </>
    );
}
