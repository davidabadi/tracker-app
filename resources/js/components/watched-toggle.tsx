import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * A watched-toggle intent (spec §10 item 6, extended): watched status is a count
 * now, not a boolean, so a tap can mean three different things. Mirrors
 * App\Enums\WatchAction.
 */
export type WatchAction = 'increment' | 'set_once' | 'reset';

/** The watch count after applying an action, for optimistic UI updates. */
export function nextWatchCount(count: number, action: WatchAction): number {
    switch (action) {
        case 'increment':
            return count + 1;
        case 'set_once':
            return 1;
        case 'reset':
            return 0;
    }
}

/**
 * The count-aware watched circle (spec §9, extended): empty when unwatched, a
 * green check at one watch, and "×N" once it's been watched more than once.
 * Purely presentational — the caller owns the tap behaviour (a bare mark, or
 * opening the multi-watch sheet).
 */
export function WatchedToggle({
    count,
    onTap,
    label,
    className,
}: {
    count: number;
    onTap: () => void;
    label: string;
    className?: string;
}) {
    const watched = count > 0;

    return (
        <button
            type="button"
            onClick={onTap}
            aria-pressed={watched}
            aria-label={
                watched
                    ? `Change watched status for ${label}`
                    : `Mark ${label} watched`
            }
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-colors',
                watched
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-transparent text-muted-foreground/50 hover:border-foreground/40 hover:text-muted-foreground',
                className,
            )}
        >
            {count > 1 ? (
                <span className="tabular-nums">×{count}</span>
            ) : (
                <Check className="size-5" strokeWidth={2.5} />
            )}
        </button>
    );
}
