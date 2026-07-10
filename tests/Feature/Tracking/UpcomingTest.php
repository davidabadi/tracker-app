<?php

declare(strict_types=1);

use App\Enums\ShowStatus;
use App\Models\Episode;
use App\Models\Movie;
use App\Models\Show;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('redirects guests away from the upcoming screens', function () {
    $this->get(route('shows.upcoming'))->assertRedirect(route('login'));
    $this->get(route('movies.upcoming'))->assertRedirect(route('login'));
});

/*
|--------------------------------------------------------------------------
| Shows › Upcoming (build order item 10)
|--------------------------------------------------------------------------
*/

it('renders only future episodes from shows this user tracks, soonest first', function () {
    $user = User::factory()->create();
    $show = Show::factory()->create();
    $user->showTrackings()->create(['show_id' => $show->id, 'status' => ShowStatus::Watching]);

    Episode::factory()->create([
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

    // Today counts as upcoming; yesterday does not. Ordered by air_date asc.
    $this->actingAs($user)->get(route('shows.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('shows/upcoming')
            ->where('today', today()->toDateString())
            ->has('episodes', 3)
            ->where('episodes.0.id', $airsToday->id)
            ->where('episodes.1.id', $soon->id)
            ->where('episodes.2.id', $later->id)
            ->where('episodes.0.show_title', $show->title)
            ->where('episodes.0.air_date', today()->toDateString())
            ->missing('episodes.3')
        );
});

it('carries this user\'s watched flag on upcoming episodes', function () {
    $user = User::factory()->create();
    $show = Show::factory()->create();
    $user->showTrackings()->create(['show_id' => $show->id, 'status' => ShowStatus::Watching]);

    // Someone can legitimately have watched a not-yet-aired episode (early
    // streaming release) — the flag must reflect that, per user.
    $seenEarly = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 1, 'episode_number' => 1, 'air_date' => today()->addDay(),
    ]);
    $unseen = Episode::factory()->create([
        'show_id' => $show->id, 'season_number' => 1, 'episode_number' => 2, 'air_date' => today()->addDay(),
    ]);
    $user->episodeWatches()->create(['episode_id' => $seenEarly->id, 'watched' => true, 'watched_date' => now()]);

    // Another member's watch of the "unseen" episode must not bleed through.
    $other = User::factory()->create();
    $other->episodeWatches()->create(['episode_id' => $unseen->id, 'watched' => true, 'watched_date' => now()]);

    $this->actingAs($user)->get(route('shows.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('shows/upcoming')
            ->has('episodes', 2)
            ->where('episodes.0.watched', true)
            ->where('episodes.1.watched', false)
        );
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

    $this->actingAs($user)->get(route('shows.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('shows/upcoming')
            ->has('episodes', 1)
            ->where('episodes.0.id', $mine->id)
        );
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
    $this->actingAs($intruder)->get(route('shows.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('shows/upcoming')
            ->has('episodes', 0)
        );

    // The owner sees their own.
    $this->actingAs($owner)->get(route('shows.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('shows/upcoming')
            ->has('episodes', 1)
        );
});

/*
|--------------------------------------------------------------------------
| Movies › Upcoming (build order item 10)
|--------------------------------------------------------------------------
*/

it('renders only future movies this user tracks, soonest first, with a day countdown', function () {
    $user = User::factory()->create();

    $past = Movie::factory()->create(['release_date' => today()->subDay()]);
    $releasedToday = Movie::factory()->create(['release_date' => today()]);
    $soon = Movie::factory()->create(['release_date' => today()->addWeek()]);
    $later = Movie::factory()->create(['release_date' => today()->addMonth()]);

    foreach ([$past, $releasedToday, $soon, $later] as $movie) {
        $user->movieTrackings()->create(['movie_id' => $movie->id]);
    }

    $this->actingAs($user)->get(route('movies.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('movies/upcoming')
            ->where('today', today()->toDateString())
            ->has('movies', 3)
            ->where('movies.0.id', $releasedToday->id)
            ->where('movies.0.days_until', 0)
            ->where('movies.1.id', $soon->id)
            ->where('movies.1.days_until', 7)
            ->where('movies.2.id', $later->id)
            ->where('movies.2.days_until', (int) today()->diffInDays(today()->addMonth()))
        );
});

it('isolates upcoming movies per user', function () {
    $owner = User::factory()->create();
    $intruder = User::factory()->create();

    $movie = Movie::factory()->create(['release_date' => today()->addWeek()]);
    $owner->movieTrackings()->create(['movie_id' => $movie->id]);

    $this->actingAs($intruder)->get(route('movies.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('movies/upcoming')
            ->has('movies', 0)
        );

    $this->actingAs($owner)->get(route('movies.upcoming'))
        ->assertOk()
        ->assertInertia(fn (Assert $inertia) => $inertia
            ->component('movies/upcoming')
            ->has('movies', 1)
            ->where('movies.0.id', $movie->id)
        );
});
