<?php

use App\Http\Controllers\EpisodeWatchController;
use App\Http\Controllers\MovieTrackingController;
use App\Http\Controllers\ShowTrackingController;
use App\Http\Controllers\UpcomingController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Simple health-check endpoint (in addition to Laravel's built-in /up).
// Verifies the app is booted and the database is reachable.
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        $database = 'ok';
    } catch (Throwable $e) {
        return response()->json([
            'status' => 'error',
            'database' => 'unreachable',
        ], 503);
    }

    return response()->json([
        'status' => 'ok',
        'database' => $database,
        'time' => now()->toIso8601String(),
    ]);
})->name('health');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');

    // Per-user show/movie tracking (spec §10 item 5). Every action is scoped to
    // the authenticated user inside the controllers; ids in the URL are only
    // ever resolved against the current user's own tracking rows.
    Route::post('track/shows', [ShowTrackingController::class, 'store'])
        ->name('track.shows.store');
    Route::patch('track/shows/{tracking}', [ShowTrackingController::class, 'update'])
        ->name('track.shows.update');

    Route::post('track/movies', [MovieTrackingController::class, 'store'])
        ->name('track.movies.store');
    // Keyed by the shared movie id: auto-creates this user's tracking row if the
    // movie isn't tracked yet, then toggles watched (spec item 6 correction).
    Route::patch('track/movies/{movie}/watched', [MovieTrackingController::class, 'toggleWatched'])
        ->name('track.movies.watched');

    // Per-user episode watched state (spec §10 item 6). Keyed by shared
    // episode/show ids; the per-user watch rows are always scoped to the current
    // user inside the controller, which also auto-tracks the show as "watching".
    Route::patch('track/episodes/{episode}/watched', [EpisodeWatchController::class, 'toggle'])
        ->name('track.episodes.watched');
    Route::patch('track/shows/{show}/seasons/{season}/watched', [EpisodeWatchController::class, 'toggleSeason'])
        ->name('track.shows.seasons.watched');
    Route::get('track/shows/{show}/episodes', [EpisodeWatchController::class, 'index'])
        ->name('track.shows.episodes');

    // Per-user "Upcoming" feed (spec §6): future episodes/movies from the shows
    // and movies this user tracks, derived by query and scoped to the current
    // user inside the controller.
    Route::get('upcoming/episodes', [UpcomingController::class, 'episodes'])
        ->name('upcoming.episodes');
    Route::get('upcoming/movies', [UpcomingController::class, 'movies'])
        ->name('upcoming.movies');
});

require __DIR__.'/settings.php';
