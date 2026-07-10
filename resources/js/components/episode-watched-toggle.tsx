import { useHttp } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { toggle } from '@/actions/App/Http/Controllers/EpisodeWatchController';
import { cn } from '@/lib/utils';

/**
 * The watched-toggle circle (spec §9): tap to flip this user's watched state
 * for one episode via the item 6 endpoint. Optimistic — the circle flips
 * immediately and rolls back if the request fails.
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

        patch(toggle.url(episodeId), {
            onError: () => setWatched(!next),
        });
    }

    return (
        <button
            type="button"
            onClick={handleToggle}
            aria-pressed={watched}
            aria-label={
                watched ? `Mark ${label} unwatched` : `Mark ${label} watched`
            }
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors',
                watched
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-transparent text-muted-foreground/50 hover:border-foreground/40 hover:text-muted-foreground',
            )}
        >
            <Check className="size-5" strokeWidth={2.5} />
        </button>
    );
}
