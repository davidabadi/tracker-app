<?php

use App\Http\Controllers\MovieTrackingController;
use App\Http\Controllers\ShowTrackingController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

// Simple health-check endpoint (in addition to Laravel's built-in /up).
// Verifies the app is booted and the database is reachable.
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();
        $database = 'ok';
    } catch (\Throwable $e) {
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
    Route::patch('track/movies/{tracking}/watched', [MovieTrackingController::class, 'toggleWatched'])
        ->name('track.movies.watched');
});

require __DIR__.'/settings.php';
