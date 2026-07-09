<?php

declare(strict_types=1);

use App\Models\Movie;
use App\Models\User;
use App\Models\UserMovieTracking;

it('redirects guests away from tracking a movie', function () {
    $this->post(route('track.movies.store'), ['tmdb_id' => 603])
        ->assertRedirect(route('login'));
});

it('tracks a movie as unwatched on first track', function () {
    fakeTmdb();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson(route('track.movies.store'), ['tmdb_id' => 603]);

    $response->assertCreated()
        ->assertJsonPath('tracking.watched', false)
        ->assertJsonPath('tracking.watched_date', null)
        ->assertJsonPath('movie.title', 'The Matrix');

    expect(Movie::count())->toBe(1);
    $this->assertDatabaseHas('user_movie_tracking', [
        'user_id' => $user->id,
        'watched' => false,
    ]);
});

it('is idempotent per user and does not duplicate the movie', function () {
    fakeTmdb();
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('track.movies.store'), ['tmdb_id' => 603])->assertCreated();
    $this->actingAs($user)->postJson(route('track.movies.store'), ['tmdb_id' => 603])->assertOk();

    expect(Movie::count())->toBe(1);
    expect(UserMovieTracking::where('user_id', $user->id)->count())->toBe(1);
});

it('toggles watched on and stamps a watched_date, then back off', function () {
    $user = User::factory()->create();
    $movie = Movie::factory()->create();
    $tracking = $user->movieTrackings()->create(['movie_id' => $movie->id]);

    // On: watched true + watched_date set.
    $this->actingAs($user)
        ->patchJson(route('track.movies.watched', $movie))
        ->assertOk()
        ->assertJsonPath('tracking.watched', true);

    $tracking->refresh();
    expect($tracking->watched)->toBeTrue()
        ->and($tracking->watched_date)->not->toBeNull();

    // Off again: watched false + watched_date cleared.
    $this->actingAs($user)
        ->patchJson(route('track.movies.watched', $movie))
        ->assertOk()
        ->assertJsonPath('tracking.watched', false)
        ->assertJsonPath('tracking.watched_date', null);

    $tracking->refresh();
    expect($tracking->watched)->toBeFalse()
        ->and($tracking->watched_date)->toBeNull();
});

it('auto-tracks an untracked movie when first marked watched', function () {
    $user = User::factory()->create();
    $movie = Movie::factory()->create();

    // No tracking row exists yet — marking watched should create one, then flip.
    expect(UserMovieTracking::where('user_id', $user->id)->count())->toBe(0);

    $this->actingAs($user)
        ->patchJson(route('track.movies.watched', $movie))
        ->assertOk()
        ->assertJsonPath('tracking.watched', true);

    $this->assertDatabaseHas('user_movie_tracking', [
        'user_id' => $user->id,
        'movie_id' => $movie->id,
        'watched' => true,
    ]);
    expect(UserMovieTracking::where('user_id', $user->id)->count())->toBe(1);
});

it('keeps each user\'s movie watched state isolated', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $movie = Movie::factory()->create();
    $tracking = $owner->movieTrackings()->create(['movie_id' => $movie->id, 'watched' => false]);

    // The intruder toggling the same shared movie only ever affects their own
    // row — the owner's stays untouched.
    $this->actingAs($intruder)
        ->patchJson(route('track.movies.watched', $movie))
        ->assertOk()
        ->assertJsonPath('tracking.watched', true);

    expect($tracking->fresh()->watched)->toBeFalse();
    expect(UserMovieTracking::where('movie_id', $movie->id)->count())->toBe(2);
});
