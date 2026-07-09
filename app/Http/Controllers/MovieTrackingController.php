<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\TrackMovieRequest;
use App\Models\UserMovieTracking;
use App\Services\Library\MediaLibraryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Movie tracking for the logged-in user (spec §10 item 5): add a movie to their
 * list (starts unwatched) and toggle its watched state.
 *
 * Scoped to the authenticated user exactly like show tracking — the toggle
 * resolves the row through $request->user()->movieTrackings(), so a foreign id
 * 404s rather than exposing or mutating another user's data.
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
     * Toggle one of this user's tracked movies watched/unwatched. watched_date
     * is auto-stamped on watch and cleared on unwatch (spec §4/§9).
     */
    public function toggleWatched(Request $request, int $tracking): JsonResponse
    {
        // Scoped to the user's own rows — a foreign tracking id 404s here.
        $model = $request->user()->movieTrackings()->findOrFail($tracking);

        $model->toggleWatched();
        $model->save();

        return response()->json(['tracking' => $this->present($model)]);
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
