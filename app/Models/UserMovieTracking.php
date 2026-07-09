<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-user movie watched state (spec §4). Fully private per user.
 *
 * watched_date is auto-set the moment a movie is toggled watched and cleared
 * when toggled back to unwatched (spec §4/§9); it remains editable afterwards.
 *
 * @property int $id
 * @property int $user_id
 * @property int $movie_id
 * @property bool $watched
 * @property CarbonImmutable|null $watched_date
 */
class UserMovieTracking extends Model
{
    // Migration table is singular; Eloquent would otherwise guess a plural.
    protected $table = 'user_movie_tracking';

    protected $fillable = ['user_id', 'movie_id', 'watched', 'watched_date'];

    // Mirror the DB default so a freshly created row (e.g. via firstOrCreate,
    // which doesn't round-trip DB defaults) reports watched=false, not null.
    protected $attributes = ['watched' => false];

    protected function casts(): array
    {
        return [
            'watched' => 'boolean',
            'watched_date' => 'datetime',
        ];
    }

    /**
     * Flip watched state and keep watched_date in step: stamped with "now" when
     * turning watched on, cleared when turning it off. Does not persist — the
     * caller saves.
     */
    public function toggleWatched(): void
    {
        $this->watched = ! $this->watched;
        $this->watched_date = $this->watched ? now() : null;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Movie, $this>
     */
    public function movie(): BelongsTo
    {
        return $this->belongsTo(Movie::class);
    }
}
