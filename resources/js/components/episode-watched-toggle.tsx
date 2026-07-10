import { router, useHttp } from '@inertiajs/react';
import { useState } from 'react';
import { toggle } from '@/actions/App/Http/Controllers/EpisodeWatchController';
import { WatchedCircle } from '@/components/watched-circle';

/**
 * Self-contained watched-toggle (spec §9): tap to flip this user's watched
 * state for one episode via the item 6 endpoint. Optimistic — the circle flips
 * immediately and rolls back if the request fails. Screens that need the
 * watched state lifted (e.g. show detail's season counts) use WatchedCircle
 * directly instead.
 */
export function EpisodeWatchedToggle({
    episodeId,
    initialWatched,
    label,
}: {
    episodeId: number;
    initialWatched: boolean;
    label: string;
}) {
    const [watched, setWatched] = useState(initialWatched);
    const { patch, processing } = useHttp({});

    function handleToggle() {
        if (processing) {
            return;
        }

        const next = !watched;
        setWatched(next);
        // Any prefetched page (nav links prefetch + cache) is now stale.
        router.flushAll();

        patch(toggle.url(episodeId), {
            onError: () => setWatched(!next),
        });
    }

    return (
        <WatchedCircle
            watched={watched}
            onToggle={handleToggle}
            label={label}
        />
    );
}
