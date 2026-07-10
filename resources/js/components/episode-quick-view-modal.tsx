import { router, useHttp } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toggle as toggleEpisodeWatched } from '@/actions/App/Http/Controllers/EpisodeWatchController';
import {
    EpisodeQuickView,
    episodeCode
    
} from '@/components/episode-quick-view';
import type {QuickViewEpisode} from '@/components/episode-quick-view';
import { WatchedCircle } from '@/components/watched-circle';
import { show as episodeShow } from '@/routes/episodes';

type EpisodeQuickViewPayload = {
    episode: QuickViewEpisode;
    show: { id: number; title: string | null };
    watched: boolean;
    watchedDate: string | null;
    previousId: number | null;
    nextId: number | null;
    position: number | null;
    total: number;
};

function localToday(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Standalone Episode Quick View, opened from screens that only know an
 * episode id (Shows › Upcoming): fetches each episode's payload as the user
 * browses previous/next, and reports on close whether anything changed so the
 * hosting screen can refresh.
 */
export function EpisodeQuickViewModal({
    episodeId,
    onClose,
}: {
    episodeId: number;
    onClose: (dirty: boolean) => void;
}) {
    const [currentId, setCurrentId] = useState(episodeId);
    const [data, setData] = useState<EpisodeQuickViewPayload | null>(null);
    const [watched, setWatched] = useState(false);
    const [watchedDate, setWatchedDate] = useState<string | null>(null);
    // Kept across navigations (unlike `data`, which clears while the next
    // episode loads) so the position dots stay mounted and animate the move.
    const [dots, setDots] = useState<{
        position: number | null;
        total: number | null;
    }>({ position: null, total: null });

    const dirty = useRef(false);

    const { get } = useHttp({});
    const toggleHttp = useHttp({});

    useEffect(() => {
        get(episodeShow.url(currentId), {
            onSuccess: (response) => {
                const payload = response as EpisodeQuickViewPayload;

                setData(payload);
                setWatched(payload.watched);
                setWatchedDate(payload.watchedDate);
                setDots({
                    position: payload.position,
                    total: payload.total,
                });
            },
            onHttpException: () => onClose(dirty.current),
            onNetworkError: () => onClose(dirty.current),
        });
        // Refetch only when browsing to another episode.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentId]);

    function handleToggle() {
        if (toggleHttp.processing || !data) {
            return;
        }

        const next = !watched;
        const previousDate = watchedDate;

        dirty.current = true;
        setWatched(next);
        setWatchedDate(next ? localToday() : null);
        router.flushAll();

        toggleHttp.patch(toggleEpisodeWatched.url(currentId), {
            onError: () => {
                setWatched(!next);
                setWatchedDate(previousDate);
            },
        });
    }

    function handleNavigate(direction: 'previous' | 'next') {
        const targetId =
            direction === 'previous' ? data?.previousId : data?.nextId;

        if (targetId != null) {
            // Clear the current payload so the skeleton shows while loading.
            setData(null);
            setCurrentId(targetId);
        }
    }

    return (
        <EpisodeQuickView
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose(dirty.current);
                }
            }}
            episode={data?.episode ?? null}
            showTitle={data?.show.title}
            watched={watched}
            watchedDate={watchedDate}
            toggle={
                <WatchedCircle
                    watched={watched}
                    onToggle={handleToggle}
                    label={data ? episodeCode(data.episode) : 'episode'}
                />
            }
            hasPrevious={data?.previousId != null}
            hasNext={data?.nextId != null}
            onNavigate={handleNavigate}
            position={dots.position}
            total={dots.total}
        />
    );
}
