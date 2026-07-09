<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ShowStatus;
use App\Http\Requests\ToggleSeasonWatchedRequest;
use App\Models\Episode;
use App\Models\Show;
use App\Models\UserEpisodeWatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-user episode watched state (spec §10 item 6): toggle a single episode,
 * bulk-toggle a whole season, and read a show's episodes back with this user's
 * watched flags.
 *
 * Design correction from item 5: toggling an episode does NOT require the show
 * to already be tracked. If there's no UserShowTracking row yet, one is
 * auto-created at status "watching" (jumping straight into an episode implies
 * active engagement, not "watch_later") before the toggle proceeds — as if the
 * user had tracked the show and immediately marked the episode.
 *
 * Everything is scoped to the authenticated user: watch rows resolve through
 * $request->user()->episodeWatches(), so one household member can never read or
 * flip another's data. The {episode}/{show} route bindings resolve *shared*
 * metadata (which is household-wide); the per-user row is always keyed by the
 * current user, so there's no foreign watch-row id to guess.
 *
 * Responses are JSON for now so these routes can be driven directly (curl /
 * tinker / tests) before any frontend exists; they become Inertia responses
 * when the Episodes tab lands (spec build-order item 11).
 */
class EpisodeWatchController extends Controller
{
    /**
     * Toggle one episode's watched state for this user. Find-or-creates the
     * per-user watch row (auto-tracking the show as "watching" first), then flips
     * it: watched_date is stamped "now" on watch and cleared on unwatch. Genuine
     * toggle — calling it twice returns to the original state.
     */
    public function toggle(Request $request, Episode $episode): JsonResponse
    {
        $this->ensureShowTracked($request, $episode->show_id);

        $watch = $request->user()->episodeWatches()->firstOrCreate(
            ['episode_id' => $episode->id],
        );

        $watch->toggleWatched();
        $watch->save();

        return response()->json(['watch' => $this->present($watch)]);
    }

    /**
     * Mark every episode in one season watched or unwatched for this user, in a
     * single batch upsert (not N queries in a loop). Auto-tracks the show as
     * "watching" first, same as the single toggle.
     */
    public function toggleSeason(ToggleSeasonWatchedRequest $request, Show $show, int $season): JsonResponse
    {
        $this->ensureShowTracked($request, $show->id);

        $watched = $request->watched();
        $episodeIds = $show->episodes()->where('season_number', $season)->pluck('id');

        $now = now();
        $rows = $episodeIds->map(fn (int $id): array => [
            'user_id' => $request->user()->id,
            'episode_id' => $id,
            'watched' => $watched,
            'watched_date' => $watched ? $now : null,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        // One statement: insert rows that don't exist yet, update watched state
        // on those that do, keyed by the (user_id, episode_id) unique index.
        if ($rows !== []) {
            UserEpisodeWatch::upsert($rows, ['user_id', 'episode_id'], ['watched', 'watched_date', 'updated_at']);
        }

        return response()->json([
            'show_id' => $show->id,
            'season' => $season,
            'watched' => $watched,
            'episodes_affected' => $episodeIds->count(),
        ]);
    }

    /**
     * Read a show's episodes back with this user's watched flag + date on each —
     * the accurate per-user view the Episodes tab will render, and how the
     * toggles above are verified. Scoped: only the current user's watch rows are
     * joined in, so another user's state never leaks.
     */
    public function index(Request $request, Show $show): JsonResponse
    {
        $episodes = $show->episodes()
            ->orderBy('season_number')
            ->orderBy('episode_number')
            ->get();

        $watches = $request->user()->episodeWatches()
            ->whereIn('episode_id', $episodes->pluck('id'))
            ->get()
            ->keyBy('episode_id');

        $payload = $episodes->map(function (Episode $episode) use ($watches): array {
            $watch = $watches->get($episode->id);

            return [
                'episode_id' => $episode->id,
                'season_number' => $episode->season_number,
                'episode_number' => $episode->episode_number,
                'title' => $episode->title,
                'watched' => (bool) $watch?->watched,
                'watched_date' => $watch?->watched_date?->toIso8601String(),
            ];
        });

        return response()->json([
            'show_id' => $show->id,
            'episodes' => $payload,
        ]);
    }

    /**
     * Auto-create this user's tracking row for the show if absent, defaulting to
     * "watching" (per the item 6 design correction). A show already tracked at
     * any status is left untouched.
     */
    private function ensureShowTracked(Request $request, int $showId): void
    {
        $request->user()->showTrackings()->firstOrCreate(
            ['show_id' => $showId],
            ['status' => ShowStatus::Watching],
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function present(UserEpisodeWatch $watch): array
    {
        return [
            'id' => $watch->id,
            'user_id' => $watch->user_id,
            'episode_id' => $watch->episode_id,
            'watched' => $watch->watched,
            'watched_date' => $watch->watched_date?->toIso8601String(),
        ];
    }
}
