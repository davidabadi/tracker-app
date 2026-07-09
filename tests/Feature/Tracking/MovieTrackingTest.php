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
        ->patchJson(route('track.movies.watched', $tracking))
        ->assertOk()
        ->assertJsonPath('tracking.watched', true);

    $tracking->refresh();
    expect($tracking->watched)->toBeTrue()
        ->and($tracking->watched_date)->not->toBeNull();

    // Off again: watched false + watched_date cleared.
    $this->actingAs($user)
        ->patchJson(route('track.movies.watched', $tracking))
        ->assertOk()
        ->assertJsonPath('tracking.watched', false)
        ->assertJsonPath('tracking.watched_date', null);

    $tracking->refresh();
    expect($tracking->watched)->toBeFalse()
        ->and($tracking->watched_date)->toBeNull();
});

it('does not let a user toggle another user\'s movie tracking', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();
    $movie = Movie::factory()->create();
    $tracking = $owner->movieTrackings()->create(['movie_id' => $movie->id, 'watched' => false]);

    $this->actingAs($intruder)
        ->patchJson(route('track.movies.watched', $tracking))
        ->assertNotFound();

    // The owner's row is untouched.
    expect($tracking->fresh()->watched)->toBeFalse();
});
