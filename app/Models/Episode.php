<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Shared episode metadata (spec §4). air_date drives the "Upcoming" query.
 *
 * @property int $id
 * @property int $show_id
 * @property int $season_number
 * @property int $episode_number
 * @property string|null $title
 * @property string|null $still_image_url
 * @property string|null $overview
 * @property CarbonImmutable|null $air_date
 * @property int|null $runtime_minutes
 */
class Episode extends Model
{
    protected $fillable = [
        'show_id',
        'season_number',
        'episode_number',
        'title',
        'still_image_url',
        'overview',
        'air_date',
        'runtime_minutes',
    ];

    protected function casts(): array
    {
        return [
            'season_number' => 'integer',
            'episode_number' => 'integer',
            'air_date' => 'date',
            'runtime_minutes' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Show, $this>
     */
    public function show(): BelongsTo
    {
        return $this->belongsTo(Show::class);
    }
}
