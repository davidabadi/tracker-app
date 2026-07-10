import { Head } from '@inertiajs/react';
import { CalendarClock, Film } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import { formatLongDate, parseDateString } from '@/lib/dates';
import { movies } from '@/routes';
import { upcoming } from '@/routes/movies';

type UpcomingMovie = {
    id: number;
    title: string;
    poster_url: string | null;
    release_date: string;
    days_until: number;
};

/**
 * Countdown buckets for the section pills (spec §5: grouped, e.g. "Later").
 */
function bucketLabel(daysUntil: number): string {
    if (daysUntil < 7) {
        return 'This Week';
    }

    if (daysUntil < 30) {
        return 'This Month';
    }

    return 'Later';
}

/** The per-row "days until" indicator (spec §5: title + countdown "X days"). */
function Countdown({ daysUntil }: { daysUntil: number }) {
    if (daysUntil <= 1) {
        return (
            <p className="shrink-0 text-sm font-bold tracking-wide uppercase">
                {daysUntil === 0 ? 'Today' : 'Tomorrow'}
            </p>
        );
    }

    return (
        <div className="shrink-0 text-right">
            <p className="text-2xl leading-none font-bold">{daysUntil}</p>
            <p className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
                days
            </p>
        </div>
    );
}

function MovieRow({ movie }: { movie: UpcomingMovie }) {
    return (
        <li className="flex items-stretch overflow-hidden rounded-xl bg-card">
            {movie.poster_url ? (
                <img
                    src={movie.poster_url}
                    alt=""
                    className="w-20 shrink-0 object-cover"
                />
            ) : (
                <div className="flex w-20 shrink-0 items-center justify-center bg-muted">
                    <Film className="size-6 text-muted-foreground" />
                </div>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-base font-semibold">
                        {movie.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {formatLongDate(parseDateString(movie.release_date))}
                    </p>
                </div>
                <Countdown daysUntil={movie.days_until} />
            </div>
        </li>
    );
}

export default function MoviesUpcoming({
    movies: upcomingMovies,
}: {
    movies: UpcomingMovie[];
    today: string;
}) {
    // Movies arrive sorted by release date; fold them into countdown buckets.
    // Insertion order keeps buckets chronological: This Week → This Month → Later.
    const sections = new Map<string, UpcomingMovie[]>();

    for (const movie of upcomingMovies) {
        const label = bucketLabel(movie.days_until);
        const group = sections.get(label) ?? [];
        group.push(movie);
        sections.set(label, group);
    }

    return (
        <>
            <Head title="Movies" />
            <Heading
                title="Movies"
                description="Your movie watch list and upcoming releases."
            />
            <MediaSubTabs
                tabs={[
                    { title: 'Watch List', href: movies() },
                    { title: 'Upcoming', href: upcoming() },
                ]}
            />
            {upcomingMovies.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="No upcoming releases"
                    description="Movies you track with a future release date will appear here, counting down to release day."
                />
            ) : (
                <div className="space-y-6">
                    {[...sections.entries()].map(([label, group]) => (
                        <section key={label}>
                            <div className="flex justify-center">
                                <span className="rounded-full bg-muted px-3.5 py-1 text-xs font-semibold tracking-wider uppercase">
                                    {label}
                                </span>
                            </div>
                            <ul className="mt-3 space-y-3">
                                {group.map((movie) => (
                                    <MovieRow key={movie.id} movie={movie} />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}
