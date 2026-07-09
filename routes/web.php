<?php

use App\Http\Controllers\EpisodeWatchController;
use App\Http\Controllers\MovieTrackingController;
use App\Http\Controllers\ShowTrackingController;
use App\Http\Controllers\UpcomingController;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Also the PWA start_url: logged-in household members land straight in the app.
Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('shows')
        : Inertia::render('welcome');
})->name('home');

// Serve the built service worker from the site root. vite-plugin-pwa emits it
// into public/build (Vite's outDir), but a service worker's maximum scope is
// its own URL path — registered as /build/sw.js it could only ever control
// /build/*. Serving the same file at /sw.js gives it scope "/" without
// needing a Service-Worker-Allowed header on the web server.
Route::get('/sw.js', function () {
    $path = public_path('build/sw.js');

    abort_unless(file_exists($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/javascript; charset=utf-8',
        'Cache-Control' => 'no-cache, must-revalidate',
    ]);
})->name('pwa.service-worker');

// Serve the PWA manifest from the root as well: the service worker's precache
// list contains a relative "manifest.webmanifest" entry (appended by
// vite-plugin-pwa after URL transforms run), which the browser resolves
// against the service worker's own URL — /sw.js — i.e. to this path. A 404
// here would fail the entire precache install.
Route::get('/manifest.webmanifest', function () {
    $path = public_path('build/manifest.webmanifest');

    abort_unless(file_exists($path), 404);

    return response()->file($path, [
        'Content-Type' => 'application/manifest+json; charset=utf-8',
        'Cache-Control' => 'no-cache, must-revalidate',
    ]);
})->name('pwa.manifest');

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
    // Main navigation shell (spec §5): Shows | Movies | Search | Profile.
    Route::inertia('shows', 'shows')->name('shows');
    Route::inertia('movies', 'movies')->name('movies');
    Route::inertia('search', 'search')->name('search');
    Route::inertia('profile', 'profile')->name('profile');

    // The starter kit's dashboard is superseded by the tab shell. The route
    // name sticks around because Fortify sends users here after login.
    Route::redirect('dashboard', '/shows')->name('dashboard');

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
