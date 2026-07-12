import { Head, router } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { EpisodeQuickViewModal } from '@/components/episode-quick-view-modal';
import Heading from '@/components/heading';
import { MediaSubTabs } from '@/components/media-sub-tabs';
import { PageScrollArea } from '@/components/page-scroll-area';
import { ShowDetailModal } from '@/components/show-detail-modal';
import { UpcomingBacklog } from '@/components/upcoming-backlog';
import {
    EpisodeRow,
    type UpcomingEpisode,
} from '@/components/upcoming-episode-row';
import {
    daysBetween,
    formatLongDate,
    formatWeekday,
    parseDateString,
} from '@/lib/dates';
import { shows } from '@/routes';
import { upcoming } from '@/routes/shows';

/**
 * Section header for one future air date: "Today" / "Tomorrow", the weekday name
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

export default function ShowsUpcoming({
    episodes,
    today,
}: {
    episodes: UpcomingEpisode[];
    today: string;
}) {
    const [episodeModalId, setEpisodeModalId] = useState<number | null>(null);
    const [showModal, setShowModal] = useState<{
        showId: number;
        title: string;
    } | null>(null);

    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Episodes arrive sorted by air date; fold them into one section per date.
    const sections = new Map<string, UpcomingEpisode[]>();

    for (const episode of episodes) {
        const group = sections.get(episode.air_date) ?? [];
        group.push(episode);
        sections.set(episode.air_date, group);
    }

    function openShow(episode: UpcomingEpisode) {
        setShowModal({
            showId: episode.show_id,
            title: episode.show_title ?? 'Show',
        });
    }

    function handleModalClose(dirty: boolean) {
        setEpisodeModalId(null);
        setShowModal(null);

        if (dirty) {
            router.reload({ only: ['episodes'] });
        }
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
                {/* Aired-but-unwatched backlog, parked off-screen above the
                    future feed and revealed by scrolling up. */}
                <UpcomingBacklog
                    scrollRef={scrollRef}
                    today={today}
                    onOpenEpisode={setEpisodeModalId}
                    onOpenShow={openShow}
                />

                {/* The future feed fills at least the viewport, so the backlog
                    above always parks off-screen on initial load. */}
                <div className="min-h-full">
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
                                                today={today}
                                                onOpenEpisode={() =>
                                                    setEpisodeModalId(
                                                        episode.id,
                                                    )
                                                }
                                                onOpenShow={() =>
                                                    openShow(episode)
                                                }
                                            />
                                        ))}
                                    </ul>
                                </section>
                            ))}
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
        </>
    );
}
