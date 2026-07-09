<?php

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
});

require __DIR__.'/settings.php';
