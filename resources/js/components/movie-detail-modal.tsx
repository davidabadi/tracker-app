import { router, useHttp } from '@inertiajs/react';
import {
    CalendarDays,
    Check,
    Clock,
    Eye,
    EyeOff,
    Film,
    Plus,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    destroy as destroyMovieTracking,
    store as storeMovieTracking,
    toggleWatched as toggleMovieWatched,
} from '@/actions/App/Http/Controllers/MovieTrackingController';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DetailModal, DetailModalSkeleton } from '@/components/detail-modal';
import { WatchedCircle } from '@/components/watched-circle';
import { formatLongDate, parseDateString } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { show as movieDetail } from '@/routes/movies';
import { open as openMovie } from '@/routes/search/movies';

type CollectionMovie = {
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    year: number | null;
};

type MovieDetailPayload = {
    movie: {
        id: number;
        title: string;
        poster_url: string | null;
        overview: string | null;
        release_date: string | null;
        runtime_minutes: number | null;
        tmdb_id: number | null;
    };
    tracked: boolean;
    watched: boolean;
    watchedDate: string | null;
    collection: {
        name: string;
        movies: CollectionMovie[];
    } | null;
};

type MovieSource =
    | { kind: 'tmdb'; id: number }
    | { kind: 'library'; id: number };

function localToday(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The movie detail modal (spec §5, build item 11): a client-side modal opened
 * by TMDB id (search results) or by local movie id (Upcoming). Shows the
 * movie's franchise siblings (TMDB collection — direct entries only, no
 * spin-offs); tapping one swaps the modal to that movie. Reports on close
 * whether anything changed so the hosting screen can refresh.
 */
export function MovieDetailModal({
    tmdbId,
    movieId,
    title,
    onClose,
}: {
    tmdbId?: number | null;
    movieId?: number | null;
    title: string;
    onClose: (dirty: boolean) => void;
}) {
    const [source, setSource] = useState<MovieSource>(
        tmdbId != null
            ? { kind: 'tmdb', id: tmdbId }
            : { kind: 'library', id: movieId ?? 0 },
    );
    const [data, setData] = useState<MovieDetailPayload | null>(null);
    const [failed, setFailed] = useState(false);

    const [tracked, setTracked] = useState(false);
    const [watched, setWatched] = useState(false);
    const [watchedDate, setWatchedDate] = useState<string | null>(null);
    const [confirmingUntrack, setConfirmingUntrack] = useState(false);

    const dirty = useRef(false);

    const { get } = useHttp({});
    const toggleHttp = useHttp({});
    const trackHttp = useHttp({ tmdb_id: null as number | null });
    const untrackHttp = useHttp({});

    useEffect(() => {
        const url =
            source.kind === 'tmdb'
                ? openMovie.url(source.id)
                : movieDetail.url(source.id);

        get(url, {
            onSuccess: (response) => {
                const payload = response as MovieDetailPayload;

                setData(payload);
                setTracked(payload.tracked);
                setWatched(payload.watched);
                setWatchedDate(payload.watchedDate);
            },
            onHttpException: () => setFailed(true),
            onNetworkError: () => setFailed(true),
        });
        // Refetch only when the modal swaps to another movie.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    function markDirty() {
        dirty.current = true;
        // Prefetched pages (Upcoming etc.) are stale after any mutation.
        router.flushAll();
    }

    function handleToggleWatched() {
        if (toggleHttp.processing || !data) {
            return;
        }

        const next = !watched;
        const previousDate = watchedDate;
        const previousTracked = tracked;

        markDirty();
        setWatched(next);
        setWatchedDate(next ? localToday() : null);
        // The toggle endpoint auto-creates the tracking row.
        setTracked(true);

        toggleHttp.patch(toggleMovieWatched.url(data.movie.id), {
            onError: () => {
                setWatched(!next);
                setWatchedDate(previousDate);
                setTracked(previousTracked);
            },
        });
    }

    function handleTrack() {
        if (tracked || trackHttp.processing || !data) {
            return;
        }

        const trackTmdbId = data.movie.tmdb_id;

        if (trackTmdbId === null) {
            return;
        }

        markDirty();
        setTracked(true);

        trackHttp.transform(() => ({ tmdb_id: trackTmdbId }));
        trackHttp.post(storeMovieTracking.url(), {
            onError: () => setTracked(false),
        });
    }

    function handleUntrackConfirmed() {
        if (!data || untrackHttp.processing) {
            return;
        }

        const snapshot = { tracked, watched, watchedDate };

        setConfirmingUntrack(false);
        markDirty();
        // Untracking resets progress: the tracking row carries watched state.
        setTracked(false);
        setWatched(false);
        setWatchedDate(null);

        untrackHttp.delete(destroyMovieTracking.url(data.movie.id), {
            onError: () => {
                setTracked(snapshot.tracked);
                setWatched(snapshot.watched);
                setWatchedDate(snapshot.watchedDate);
            },
        });
    }

    const close = () => onClose(dirty.current);

    const canTrack = data !== null && data.movie.tmdb_id !== null;

    return (
        <>
            <DetailModal
                label={data?.movie.title ?? title}
                onClose={close}
                escapeDisabled={confirmingUntrack}
            >
                {failed ? (
                    <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                        Could not load this movie. Close and try again.
                    </p>
                ) : data === null ? (
                    <DetailModalSkeleton />
                ) : (
                    <>
                        <div className="relative h-64 overflow-hidden rounded-t-2xl md:h-72">
                            {data.movie.poster_url ? (
                                <img
                                    src={data.movie.poster_url}
                                    alt=""
                                    className="size-full object-cover object-[center_20%]"
                                />
                            ) : (
                                <div className="flex size-full items-center justify-center bg-muted">
                                    <Film className="size-10 text-muted-foreground" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                            <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-3">
                                <h1 className="min-w-0 truncate text-2xl font-bold">
                                    {data.movie.title}
                                </h1>
                                <div className="flex shrink-0 items-center gap-2.5">
                                    {(tracked || canTrack) && (
                                        <button
                                            type="button"
                                            onClick={
                                                tracked
                                                    ? () =>
                                                          setConfirmingUntrack(
                                                              true,
                                                          )
                                                    : handleTrack
                                            }
                                            aria-label={
                                                tracked
                                                    ? `Untrack ${data.movie.title}`
                                                    : `Track ${data.movie.title}`
                                            }
                                            className={cn(
                                                'flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                                                tracked
                                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                                    : 'border-border bg-background/60 text-muted-foreground backdrop-blur hover:border-foreground/40 hover:text-foreground',
                                            )}
                                        >
                                            {tracked ? (
                                                <Check
                                                    className="size-5"
                                                    strokeWidth={2.5}
                                                />
                                            ) : (
                                                <Plus className="size-5" />
                                            )}
                                        </button>
                                    )}
                                    <WatchedCircle
                                        watched={watched}
                                        onToggle={handleToggleWatched}
                                        label={data.movie.title}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-4 pt-5 md:px-6">
                            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="size-3.5" />
                                    {data.movie.release_date
                                        ? formatLongDate(
                                              parseDateString(
                                                  data.movie.release_date,
                                              ),
                                          )
                                        : 'Release date TBA'}
                                </span>
                                {data.movie.runtime_minutes !== null &&
                                    data.movie.runtime_minutes > 0 && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <Clock className="size-3.5" />
                                            {data.movie.runtime_minutes} min
                                        </span>
                                    )}
                                <span className="inline-flex items-center gap-1.5">
                                    {watched ? (
                                        <>
                                            <Eye className="size-3.5 text-emerald-400" />
                                            {watchedDate
                                                ? `Watched ${formatLongDate(parseDateString(watchedDate))}`
                                                : 'Watched'}
                                        </>
                                    ) : (
                                        <>
                                            <EyeOff className="size-3.5" />
                                            Not watched
                                        </>
                                    )}
                                </span>
                            </div>

                            <section>
                                <h2 className="mb-2 text-lg font-semibold">
                                    About
                                </h2>
                                <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                                    {data.movie.overview ??
                                        'No overview available.'}
                                </p>
                            </section>

                            {data.collection && (
                                <section className="mt-6">
                                    <h2 className="mb-3 text-lg font-semibold">
                                        {data.collection.name}
                                    </h2>
                                    {/* Breathing room on every edge so the
                                        current movie's ring isn't clipped by
                                        the scroll container. */}
                                    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2">
                                        {data.collection.movies.map((part) => {
                                            // The whole run is shown — the
                                            // current movie included, marked
                                            // and inert — so the release
                                            // order stays readable.
                                            const isCurrent =
                                                part.tmdb_id ===
                                                data.movie.tmdb_id;

                                            return (
                                                <button
                                                    key={part.tmdb_id}
                                                    type="button"
                                                    disabled={isCurrent}
                                                    onClick={() => {
                                                        // Swap the modal to
                                                        // this movie: clear
                                                        // the payload so the
                                                        // skeleton shows.
                                                        setData(null);
                                                        setFailed(false);
                                                        setSource({
                                                            kind: 'tmdb',
                                                            id: part.tmdb_id,
                                                        });
                                                    }}
                                                    className="w-24 shrink-0 text-left"
                                                >
                                                    {part.poster_url ? (
                                                        <img
                                                            src={
                                                                part.poster_url
                                                            }
                                                            alt=""
                                                            className={cn(
                                                                'aspect-2/3 w-full rounded-lg object-cover',
                                                                isCurrent
                                                                    ? 'ring-2 ring-emerald-500'
                                                                    : 'transition-opacity hover:opacity-80',
                                                            )}
                                                        />
                                                    ) : (
                                                        <div
                                                            className={cn(
                                                                'flex aspect-2/3 w-full items-center justify-center rounded-lg bg-muted',
                                                                isCurrent &&
                                                                    'ring-2 ring-emerald-500',
                                                            )}
                                                        >
                                                            <Film className="size-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <p
                                                        className={cn(
                                                            'mt-1.5 line-clamp-2 text-xs font-medium',
                                                            isCurrent &&
                                                                'text-emerald-400',
                                                        )}
                                                    >
                                                        {part.title}
                                                    </p>
                                                    {part.year !== null && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {part.year}
                                                        </p>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}
                        </div>
                    </>
                )}
            </DetailModal>

            <ConfirmDialog
                open={confirmingUntrack}
                title={`Untrack ${data?.movie.title ?? title}?`}
                description="This removes the movie from your list and marks it as not watched."
                confirmLabel="Untrack"
                destructive
                onConfirm={handleUntrackConfirmed}
                onOpenChange={setConfirmingUntrack}
            />
        </>
    );
}
