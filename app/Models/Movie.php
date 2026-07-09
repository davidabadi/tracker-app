<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Database\Factories\MovieFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Shared movie metadata (spec §4) — one row per title regardless of who tracks
 * it. release_date drives the "Upcoming" query.
 *
 * @property int $id
 * @property string $title
 * @property string|null $poster_image_url
 * @property string|null $overview
 * @property CarbonImmutable|null $release_date
 * @property int|null $runtime_minutes
 */
class Movie extends Model
{
    /** @use HasFactory<MovieFactory> */
    use HasFactory;

    protected $fillable = [
        'title',
        'poster_image_url',
        'overview',
        'release_date',
        'runtime_minutes',
    ];

    protected function casts(): array
    {
        return [
            'release_date' => 'date',
            'runtime_minutes' => 'integer',
        ];
    }

    /**
     * @return HasMany<UserMovieTracking, $this>
     */
    public function trackings(): HasMany
    {
        return $this->hasMany(UserMovieTracking::class);
    }

    /**
     * Provider lookup keys (tmdb, trakt, ...) attached to this movie.
     *
     * @return MorphMany<MediaExternalId, $this>
     */
    public function externalIds(): MorphMany
    {
        return $this->morphMany(MediaExternalId::class, 'media', 'media_type', 'media_id');
    }
}
