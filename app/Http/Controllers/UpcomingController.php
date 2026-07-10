<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The "Upcoming" screens (spec §5/§6): future episodes/movies for the logged-in
 * user, derived by query — there is no stored upcoming table. An item is
 * upcoming when its air_date / release_date is today or later AND the current
 * user tracks the parent show / the movie.
 *
 * Per-user isolation is enforced in the query itself: the whereHas constrains on
 * the current user's own tracking rows, so one household member's upcoming feed
 * can never surface a title only another member tracks.
 *
 * Both pages receive a `today` prop so the client groups dates by the server's
 * calendar day — the same cutoff the query used — instead of the browser clock,
 * which may sit on the other side of midnight in another timezone.
 */
class UpcomingController extends Controller
{
    /**
     * Shows › Upcoming: future episodes from shows this user tracks, soonest
     * first, each carrying this user's watched flag — an upcoming episode can
     * legitimately be watched already (seen early via streaming).
     */
    public function episodes(Request $request): Response
    {
        $user = $request->user();

        $episodes = Episode::query()
            ->whereNotNull('air_date')
            ->whereDate('air_date', '>=', today())
            // Specials (season 0) are not part of a show's tracked run.
            ->where('season_number', '>', 0)
            ->whereHas('show.trackings', function ($query) use ($user): void {
                $query->where('user_id', $user->id);
            })
            ->orderBy('air_date')
            ->orderBy('season_number')
            ->orderBy('episode_number')
            ->with('show:id,title,poster_image_url')
            ->get();

        $watchedEpisodeIds = $user->episodeWatches()
            ->whereIn('episode_id', $episodes->pluck('id'))
            ->where('watched', true)
            ->pluck('episode_id')
            ->flip();

        return Inertia::render('shows/upcoming', [
            'episodes' => $episodes->map(fn (Episode $episode): array => [
                'id' => $episode->id,
                'show_id' => $episode->show_id,
                'show_title' => $episode->show?->title,
                'show_poster_url' => $episode->show?->poster_image_url,
                'season_number' => $episode->season_number,
                'episode_number' => $episode->episode_number,
                'title' => $episode->title,
                'air_date' => $episode->air_date?->toDateString(),
                'watched' => $watchedEpisodeIds->has($episode->id),
            ])->values()->all(),
            'today' => today()->toDateString(),
        ]);
    }

    /**
     * Movies › Upcoming: future movies this user tracks, soonest first, with a
     * server-computed day countdown (spec §5: title + "X days").
     */
    public function movies(Request $request): Response
    {
        $user = $request->user();

        $movies = Movie::query()
            ->whereNotNull('release_date')
            ->whereDate('release_date', '>=', today())
            ->whereHas('trackings', function ($query) use ($user): void {
                $query->where('user_id', $user->id);
            })
            ->orderBy('release_date')
            ->get();

        return Inertia::render('movies/upcoming', [
            'movies' => $movies->map(fn (Movie $movie): array => [
                'id' => $movie->id,
                'title' => $movie->title,
                'poster_url' => $movie->poster_image_url,
                'release_date' => $movie->release_date?->toDateString(),
                'days_until' => (int) today()->diffInDays($movie->release_date),
            ])->values()->all(),
            'today' => today()->toDateString(),
        ]);
    }
}
