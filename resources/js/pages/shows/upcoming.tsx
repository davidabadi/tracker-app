import { Head } from '@inertiajs/react';
import { CalendarClock, Tv } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { EpisodeWatchedToggle } from '@/components/episode-watched-toggle';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import {
    daysBetween,
    formatLongDate,
    formatWeekday,
    parseDateString,
} from '@/lib/dates';
import { shows } from '@/routes';
import { upcoming } from '@/routes/shows';

type UpcomingEpisode = {
    id: number;
    show_id: number;
    show_title: string | null;
    show_poster_url: string | null;
    season_number: number;
    episode_number: number;
    title: string | null;
    air_date: string;
    watched: boolean;
};

/**
 * Section header for one air date: "Today" / "Tomorrow", the weekday name
 * inside the next week, then full calendar dates further out (spec §5).
 */
function sectionLabel(airDate: string, today: string): string {
    const date = parseDateString(airDate);
    const days = daysBetween(parseDateString(today), date);

    if (days === 0) {
        return 'Today';
    }

    if (days === 1) {
        return 'Tomorrow';
    }

    if (days < 7) {
        return formatWeekday(date);
    }

    return formatLongDate(date);
}

function episodeCode(episode: UpcomingEpisode): string {
    const season = String(episode.season_number).padStart(2, '0');
    const number = String(episode.episode_number).padStart(2, '0');

    return `S${season} | E${number}`;
}

function EpisodeRow({ episode }: { episode: UpcomingEpisode }) {
    const showTitle = episode.show_title ?? 'Unknown show';

    return (
        <li className="flex items-stretch overflow-hidden rounded-xl bg-card">
            {episode.show_poster_url ? (
                <img
                    src={episode.show_poster_url}
                    alt=""
                    className="w-20 shrink-0 object-cover"
                />
            ) : (
                <div className="flex w-20 shrink-0 items-center justify-center bg-muted">
                    <Tv className="size-6 text-muted-foreground" />
                </div>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1 space-y-1">
                    <span className="inline-flex max-w-full items-center rounded-full border border-foreground/25 px-3 py-0.5 text-xs font-semibold tracking-wide uppercase">
                        <span className="truncate">{showTitle}</span>
                    </span>
                    <p className="text-base font-semibold">
                        {episodeCode(episode)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                        {episode.title ?? 'TBA'}
                    </p>
                </div>
                <EpisodeWatchedToggle
                    episodeId={episode.id}
                    initialWatched={episode.watched}
                    label={`${showTitle} ${episodeCode(episode)}`}
                />
            </div>
        </li>
    );
}

export default function ShowsUpcoming({
    episodes,
    today,
}: {
    episodes: UpcomingEpisode[];
    today: string;
}) {
    // Episodes arrive sorted by air date; fold them into one section per date.
    const sections = new Map<string, UpcomingEpisode[]>();

    for (const episode of episodes) {
        const group = sections.get(episode.air_date) ?? [];
        group.push(episode);
        sections.set(episode.air_date, group);
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
            {episodes.length === 0 ? (
                <EmptyState
                    icon={CalendarClock}
                    title="Nothing on the calendar"
                    description="Upcoming episodes from shows you track will appear here as air dates are announced."
                />
            ) : (
                <div className="space-y-6">
                    {[...sections.entries()].map(([airDate, group]) => (
                        <section key={airDate}>
                            <div className="flex justify-center">
                                <span className="rounded-full bg-muted px-3.5 py-1 text-xs font-semibold tracking-wider uppercase">
                                    {sectionLabel(airDate, today)}
                                </span>
                            </div>
                            <ul className="mt-3 space-y-3">
                                {group.map((episode) => (
                                    <EpisodeRow
                                        key={episode.id}
                                        episode={episode}
                                    />
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            )}
        </>
    );
}
