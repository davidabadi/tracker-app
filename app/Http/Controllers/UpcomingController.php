<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The "Upcoming" feed (spec §6): future episodes/movies for the logged-in user,
 * derived by query — there is no stored upcoming table. An item is upcoming when
 * its air_date / release_date is today or later AND the current user tracks the
 * parent show / the movie.
 *
 * Per-user isolation is enforced in the query itself: the whereHas constrains on
 * the current user's own tracking rows, so one household member's upcoming feed
 * can never surface a title only another member tracks.
 *
 * Responses are JSON so these read routes can be driven directly (curl / tinker /
 * tests) before any frontend exists; they become Inertia responses when the
 * Upcoming screens land (spec build-order item 10).
 */
class UpcomingController extends Controller
{
    /**
     * Future episodes from shows this user tracks, soonest first.
     */
    public function episodes(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $episodes = Episode::query()
            ->whereNotNull('air_date')
            ->whereDate('air_date', '>=', today())
            ->whereHas('show.trackings', function ($query) use ($userId): void {
                $query->where('user_id', $userId);
            })
            ->orderBy('air_date')
            ->orderBy('season_number')
            ->orderBy('episode_number')
            ->with('show:id,title')
            ->get();

        return response()->json([
            'episodes' => $episodes->map(fn (Episode $episode): array => [
                'episode_id' => $episode->id,
                'show_id' => $episode->show_id,
                'show_title' => $episode->show?->title,
                'season_number' => $episode->season_number,
                'episode_number' => $episode->episode_number,
                'title' => $episode->title,
                'air_date' => $episode->air_date?->toDateString(),
            ])->values(),
        ]);
    }

    /**
     * Future movies this user tracks, soonest first.
     */
    public function movies(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $movies = Movie::query()
            ->whereNotNull('release_date')
            ->whereDate('release_date', '>=', today())
            ->whereHas('trackings', function ($query) use ($userId): void {
                $query->where('user_id', $userId);
            })
            ->orderBy('release_date')
            ->get();

        return response()->json([
            'movies' => $movies->map(fn (Movie $movie): array => [
                'movie_id' => $movie->id,
                'title' => $movie->title,
                'release_date' => $movie->release_date?->toDateString(),
            ])->values(),
        ]);
    }
}
