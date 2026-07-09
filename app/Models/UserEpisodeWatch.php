<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-user episode watched state (spec §4). Fully private per user — every
 * read/write is scoped to a single user_id.
 *
 * watched_date is auto-set the moment an episode is toggled watched and cleared
 * when toggled back to unwatched (spec §4/§9); it remains editable afterwards.
 * Mirrors UserMovieTracking, whose toggle this is deliberately identical to.
 *
 * @property int $id
 * @property int $user_id
 * @property int $episode_id
 * @property bool $watched
 * @property CarbonImmutable|null $watched_date
 */
class UserEpisodeWatch extends Model
{
    // Migration table is plural (user_episode_watches); this matches Eloquent's
    // default guess, but we state it for symmetry with the other tracking models.
    protected $table = 'user_episode_watches';

    protected $fillable = ['user_id', 'episode_id', 'watched', 'watched_date'];

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
     * @return BelongsTo<Episode, $this>
     */
    public function episode(): BelongsTo
    {
        return $this->belongsTo(Episode::class);
    }
}
