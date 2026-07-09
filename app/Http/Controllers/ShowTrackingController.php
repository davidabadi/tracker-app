<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\TrackShowRequest;
use App\Http\Requests\UpdateShowStatusRequest;
use App\Models\UserShowTracking;
use App\Services\Library\MediaLibraryService;
use Illuminate\Http\JsonResponse;

/**
 * Show tracking for the logged-in user (spec §10 item 5): add a show to their
 * list with a status, and move it between statuses.
 *
 * Every action is scoped to the authenticated user. Reads/writes go through
 * $request->user()->showTrackings(), so one household member can never see or
 * touch another's rows even by guessing an id — a foreign id simply 404s.
 *
 * Responses are JSON for now so these routes can be driven directly (curl /
 * Postman / tests) before any frontend exists; they become Inertia responses
 * when the Shows screens land (spec build-order items 8–9).
 */
class ShowTrackingController extends Controller
{
    /**
     * Track a show: find-or-create the shared Show (pulling its full
     * season/episode data from TMDB the first time the household sees it), then
     * upsert this user's tracking row at the requested status.
     */
    public function store(TrackShowRequest $request, MediaLibraryService $library): JsonResponse
    {
        $show = $library->findOrCreateShow((int) $request->integer('tmdb_id'));

        $tracking = $request->user()->showTrackings()->updateOrCreate(
            ['show_id' => $show->id],
            ['status' => $request->status()],
        );

        return response()->json([
            'tracking' => $this->present($tracking),
            'show' => [
                'id' => $show->id,
                'title' => $show->title,
                'seasons' => $show->seasons()->count(),
                'episodes' => $show->episodes()->count(),
            ],
        ], $tracking->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Move one of this user's tracked shows to a new status.
     */
    public function update(UpdateShowStatusRequest $request, int $tracking): JsonResponse
    {
        // Scoped to the user's own rows — a foreign tracking id 404s here.
        $model = $request->user()->showTrackings()->findOrFail($tracking);

        $model->update(['status' => $request->status()]);

        return response()->json(['tracking' => $this->present($model)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(UserShowTracking $tracking): array
    {
        return [
            'id' => $tracking->id,
            'user_id' => $tracking->user_id,
            'show_id' => $tracking->show_id,
            'status' => $tracking->status->value,
        ];
    }
}
