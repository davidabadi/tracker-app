<?php

declare(strict_types=1);

namespace App\Services\Library;

use App\Models\Episode;
use App\Models\MediaExternalId;
use App\Models\Movie;
use App\Models\Season;
use App\Models\Show;
use App\Services\Metadata\Data\MediaType;
use App\Services\Metadata\Data\ShowDetails;
use App\Services\Metadata\Tmdb\TmdbService;
use Illuminate\Support\Facades\DB;

/**
 * Turns a provider (TMDB) id into a persisted, shared Show/Movie row — the
 * find-or-create + full season/episode pull that was deliberately deferred out
 * of the TMDB session and belongs here, at track time (spec §4/§10 item 5).
 *
 * "Find" is a cheap lookup through media_external_ids; the household never
 * re-fetches metadata it already has. "Create" is the expensive path (one TMDB
 * call per season for shows) and only runs the first time a title is tracked.
 *
 * This layer knows how to map provider DTOs onto our own rows, so it depends on
 * the concrete TmdbService: it needs imageUrl() to turn raw poster/still paths
 * into the full URLs our columns store, which is TMDB-specific and not part of
 * the read-through provider interface.
 */
final readonly class MediaLibraryService
{
    private const PROVIDER = 'tmdb';

    public function __construct(
        private TmdbService $tmdb,
    ) {}

    /**
     * Find our Show for this TMDB id, or create it (plus every season and
     * episode) by pulling full details from TMDB. Idempotent: a title already
     * in the library is returned as-is, with no second fetch and no duplicate.
     */
    public function findOrCreateShow(int $tmdbId): Show
    {
        $existing = $this->existingMedia(MediaType::Show, $tmdbId);

        if ($existing instanceof Show) {
            return $existing;
        }

        $details = $this->tmdb->fetchShowDetails($tmdbId);

        return DB::transaction(fn (): Show => $this->persistShow($details));
    }

    /**
     * Find our Movie for this TMDB id, or create it by pulling full details
     * from TMDB. Idempotent, like findOrCreateShow().
     */
    public function findOrCreateMovie(int $tmdbId): Movie
    {
        $existing = $this->existingMedia(MediaType::Movie, $tmdbId);

        if ($existing instanceof Movie) {
            return $existing;
        }

        $details = $this->tmdb->fetchMovieDetails($tmdbId);

        return DB::transaction(function () use ($details): Movie {
            $movie = Movie::create([
                'title' => $details->title,
                'poster_image_url' => $this->tmdb->imageUrl($details->posterPath),
                'overview' => $details->overview,
                'release_date' => $details->releaseDate,
                'runtime_minutes' => $details->runtimeMinutes,
            ]);

            $this->linkExternalId(MediaType::Movie, $movie->id, $details->tmdbId);

            return $movie;
        });
    }

    private function persistShow(ShowDetails $details): Show
    {
        $show = Show::create([
            'title' => $details->title,
            'poster_image_url' => $this->tmdb->imageUrl($details->posterPath),
            'overview' => $details->overview,
        ]);

        foreach ($details->seasons as $season) {
            Season::create([
                'show_id' => $show->id,
                'season_number' => $season->seasonNumber,
                'episode_count' => $season->episodeCount,
            ]);

            foreach ($season->episodes as $episode) {
                Episode::create([
                    'show_id' => $show->id,
                    'season_number' => $episode->seasonNumber,
                    'episode_number' => $episode->episodeNumber,
                    'title' => $episode->title,
                    'still_image_url' => $this->tmdb->imageUrl($episode->stillPath),
                    'overview' => $episode->overview,
                    'air_date' => $episode->airDate,
                    'runtime_minutes' => $episode->runtimeMinutes,
                ]);
            }
        }

        $this->linkExternalId(MediaType::Show, $show->id, $details->tmdbId);

        return $show;
    }

    /**
     * Resolve an existing Show/Movie via its TMDB external id, or null if the
     * household has never tracked this title before.
     */
    private function existingMedia(MediaType $type, int $tmdbId): Show|Movie|null
    {
        $link = MediaExternalId::query()
            ->where('provider', self::PROVIDER)
            ->where('media_type', $type->value)
            ->where('external_id', (string) $tmdbId)
            ->first();

        if ($link === null) {
            return null;
        }

        return match ($type) {
            MediaType::Show => Show::find($link->media_id),
            MediaType::Movie => Movie::find($link->media_id),
        };
    }

    private function linkExternalId(MediaType $type, int $mediaId, int $tmdbId): void
    {
        MediaExternalId::create([
            'media_type' => $type->value,
            'media_id' => $mediaId,
            'provider' => self::PROVIDER,
            'external_id' => (string) $tmdbId,
        ]);
    }
}
