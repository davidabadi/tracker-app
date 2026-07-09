<?php

declare(strict_types=1);

use App\Enums\ShowStatus;
use App\Models\Episode;
use App\Models\Movie;
use App\Models\Show;
use App\Models\User;

it('redirects guests away from the upcoming feeds', function () {
    $this->getJson(route('upcoming.episodes'))->assertUnauthorized();
    $this->getJson(route('upcoming.movies'))->assertUnauthorized();
});

/*
|--------------------------------------------------------------------------
| Upcoming episodes (scope item 3 — episodes)
|--------------------------------------------------------------------------
*/

it('returns only future episodes from shows this user tracks, soonest first', function () {
    $user = User::factory()->create();
    $show = Show::factory()->create();
    $user->showTrackings()->create(['show_id' => $show->id, 'status' => ShowStatus::Watching]);

    $past = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 1, 'episode_number' => 1, 'air_date' => today()->subDay(),
    ]);
    $airsToday = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 1, 'episode_number' => 2, 'air_date' => today(),
    ]);
    $soon = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 1, 'episode_number' => 3, 'air_date' => today()->addWeek(),
    ]);
    $later = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 2, 'episode_number' => 1, 'air_date' => today()->addMonth(),
    ]);

    $response = $this->actingAs($user)->getJson(route('upcoming.episodes'))->assertOk();

    // Today counts as upcoming; yesterday does not. Ordered by air_date asc.
    $ids = collect($response->json('episodes'))->pluck('episode_id');
    expect($ids->all())->toBe([$airsToday->id, $soon->id, $later->id])
        ->and($ids)->not->toContain($past->id);
});

it('excludes episodes from shows the user does not track', function () {
    $user = User::factory()->create();
    $tracked = Show::factory()->create();
    $user->showTrackings()->create(['show_id' => $tracked->id, 'status' => ShowStatus::Watching]);

    $untracked = Show::factory()->create();
    Episode::factory()->create([
        'show_id' => $untracked->id, 'season_number' => 1, 'episode_number' => 1, 'air_date' => today()->addWeek(),
    ]);
    $mine = Episode::factory()->create([
        'show_id' => $tracked->id, 'season_number' => 1, 'episode_number' => 1, 'air_date' => today()->addWeek(),
    ]);

    $response = $this->actingAs($user)->getJson(route('upcoming.episodes'))->assertOk();

    $response->assertJsonCount(1, 'episodes')
        ->assertJsonPath('episodes.0.episode_id', $mine->id);
});

it('isolates upcoming episodes per user — one member never sees another\'s tracked show', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $ownersShow = Show::factory()->create();
    $owner->showTrackings()->create(['show_id' => $ownersShow->id, 'status' => ShowStatus::Watching]);
    Episode::factory()->create([
        'show_id' => $ownersShow->id, 'season_number' => 1, 'episode_number' => 1, 'air_date' => today()->addWeek(),
    ]);

    // The intruder tracks nothing → an empty feed even though the episode exists.
    $this->actingAs($intruder)->getJson(route('upcoming.episodes'))
        ->assertOk()
        ->assertJsonCount(0, 'episodes');

    // The owner sees their own.
    $this->actingAs($owner)->getJson(route('upcoming.episodes'))
        ->assertOk()
        ->assertJsonCount(1, 'episodes');
});

/*
|--------------------------------------------------------------------------
| Upcoming movies (scope item 3 — movies)
|--------------------------------------------------------------------------
*/

it('returns only future movies this user tracks, soonest first', function () {
    $user = User::factory()->create();

    $past = Movie::factory()->create(['release_date' => today()->subDay()]);
    $releasedToday = Movie::factory()->create(['release_date' => today()]);
    $soon = Movie::factory()->create(['release_date' => today()->addWeek()]);
    $later = Movie::factory()->create(['release_date' => today()->addMonth()]);

    foreach ([$past, $releasedToday, $soon, $later] as $movie) {
        $user->movieTrackings()->create(['movie_id' => $movie->id]);
    }

    $response = $this->actingAs($user)->getJson(route('upcoming.movies'))->assertOk();

    $ids = collect($response->json('movies'))->pluck('movie_id');
    expect($ids->all())->toBe([$releasedToday->id, $soon->id, $later->id])
        ->and($ids)->not->toContain($past->id);
});

it('isolates upcoming movies per user', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $movie = Movie::factory()->create(['release_date' => today()->addWeek()]);
    $owner->movieTrackings()->create(['movie_id' => $movie->id]);

    $this->actingAs($intruder)->getJson(route('upcoming.movies'))
        ->assertOk()
        ->assertJsonCount(0, 'movies');

    $this->actingAs($owner)->getJson(route('upcoming.movies'))
        ->assertOk()
        ->assertJsonCount(1, 'movies')
        ->assertJsonPath('movies.0.movie_id', $movie->id);
});
