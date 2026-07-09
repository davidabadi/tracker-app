<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\TrackMovieRequest;
use App\Models\Movie;
use App\Models\UserMovieTracking;
use App\Services\Library\MediaLibraryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Movie tracking for the logged-in user (spec §10 item 5): add a movie to their
 * list (starts unwatched) and toggle its watched state.
 *
 * Scoped to the authenticated user: the toggle keys off the *shared* Movie plus
 * the current user, resolving the per-user row through
 * $request->user()->movieTrackings(). A user only ever touches their own row, so
 * there's no foreign tracking id to guess.
 *
 * Responses are JSON for now (see ShowTrackingController for the rationale).
 */
class MovieTrackingController extends Controller
{
    /**
     * Track a movie: find-or-create the shared Movie (pulling its details from
     * TMDB the first time), then upsert this user's tracking row. Re-tracking an
     * already-tracked movie leaves its watched state untouched.
     */
    public function store(TrackMovieRequest $request, MediaLibraryService $library): JsonResponse
    {
        $movie = $library->findOrCreateMovie((int) $request->integer('tmdb_id'));

        $tracking = $request->user()->movieTrackings()->firstOrCreate(
            ['movie_id' => $movie->id],
        );

        return response()->json([
            'tracking' => $this->present($tracking),
            'movie' => [
                'id' => $movie->id,
                'title' => $movie->title,
                'release_date' => $movie->release_date?->toDateString(),
                'runtime_minutes' => $movie->runtime_minutes,
            ],
        ], $tracking->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Toggle a movie watched/unwatched for this user. watched_date is
     * auto-stamped on watch and cleared on unwatch (spec §4/§9).
     *
     * Keyed by the shared Movie, not by a tracking-row id: per the item 6 design
     * correction, marking an *untracked* movie watched must just work — so the
     * user's tracking row is find-or-created first, then toggled. (Movies have no
     * status field, so there's nothing to default the way shows default to
     * "watching".)
     */
    public function toggleWatched(Request $request, Movie $movie): JsonResponse
    {
        $tracking = $request->user()->movieTrackings()->firstOrCreate(
            ['movie_id' => $movie->id],
        );

        $tracking->toggleWatched();
        $tracking->save();

        return response()->json(['tracking' => $this->present($tracking)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(UserMovieTracking $tracking): array
    {
        return [
            'id' => $tracking->id,
            'user_id' => $tracking->user_id,
            'movie_id' => $tracking->movie_id,
            'watched' => $tracking->watched,
            'watched_date' => $tracking->watched_date?->toIso8601String(),
        ];
    }
}
