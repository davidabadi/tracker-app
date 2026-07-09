<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

/**
 * Fake the TMDB endpoints hit while building a show/movie (id 1399 / 603) so the
 * real TmdbService parsing runs against controlled data — no network involved.
 * Shared by the tracking feature tests.
 */
function fakeTmdb(): void
{
    \Illuminate\Support\Facades\Http::fake([
        'api.themoviedb.org/3/tv/1399/season/1*' => \Illuminate\Support\Facades\Http::response([
            'episodes' => [
                ['season_number' => 1, 'episode_number' => 1, 'name' => 'Ep1', 'still_path' => '/s1e1.jpg', 'overview' => 'o1', 'air_date' => '2020-01-01', 'runtime' => 42],
                ['season_number' => 1, 'episode_number' => 2, 'name' => 'Ep2', 'still_path' => null, 'overview' => '', 'air_date' => '', 'runtime' => 45],
            ],
        ]),
        'api.themoviedb.org/3/tv/1399/season/2*' => \Illuminate\Support\Facades\Http::response([
            'episodes' => [
                ['season_number' => 2, 'episode_number' => 1, 'name' => 'S2E1', 'still_path' => '/s2e1.jpg', 'overview' => 'o', 'air_date' => '2021-01-01', 'runtime' => 50],
            ],
        ]),
        'api.themoviedb.org/3/tv/1399*' => \Illuminate\Support\Facades\Http::response([
            'id' => 1399,
            'name' => 'Test Show',
            'poster_path' => '/poster.jpg',
            'backdrop_path' => '/backdrop.jpg',
            'overview' => 'A show overview',
            'seasons' => [
                ['season_number' => 1],
                ['season_number' => 2],
            ],
        ]),
        'api.themoviedb.org/3/movie/603*' => \Illuminate\Support\Facades\Http::response([
            'id' => 603,
            'title' => 'The Matrix',
            'poster_path' => '/matrix.jpg',
            'overview' => 'A movie overview',
            'release_date' => '1999-03-31',
            'runtime' => 136,
        ]),
    ]);
}
