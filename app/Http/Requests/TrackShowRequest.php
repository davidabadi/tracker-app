<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\ShowStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validates a "track this show" request: a TMDB id, plus an optional status
 * that defaults to watch_later when omitted (spec §10 item 5).
 */
class TrackShowRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // auth + verified enforced by route middleware
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'tmdb_id' => ['required', 'integer', 'min:1'],
            'status' => ['sometimes', 'nullable', Rule::enum(ShowStatus::class)],
        ];
    }

    /**
     * The requested status, or the watch_later default when none was given.
     */
    public function status(): ShowStatus
    {
        $status = $this->input('status');

        return $status !== null && $status !== ''
            ? ShowStatus::from((string) $status)
            : ShowStatus::WatchLater;
    }
}
