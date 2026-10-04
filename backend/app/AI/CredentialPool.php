<?php

namespace App\AI;

use App\AI\Exceptions\ProviderError;
use App\Models\AiCredential;
use Illuminate\Support\Collection;

/**
 * Which keys may be used, in what order, and what a success or a failure
 * does to a key.
 *
 * State changes are written as conditional updates rather than by saving the
 * model: if the key was disabled in the dashboard while a request was in
 * flight, the request finishing must not switch it back on.
 */
class CredentialPool
{
    /** @return Collection<int, AiCredential> best first */
    public function candidates(): Collection
    {
        return AiCredential::query()->available()->ordered()->get();
    }

    public function succeeded(AiCredential $credential): void
    {
        AiCredential::query()
            ->whereKey($credential->id)
            ->whereIn('status', [CredentialStatus::Active, CredentialStatus::CoolingDown])
            ->update([
                'status' => CredentialStatus::Active,
                'available_at' => null,
                'cooldown_step' => 0,
                'consecutive_failures' => 0,
                'last_used_at' => now(),
                'last_success_at' => now(),
            ]);
    }

    public function failed(AiCredential $credential, ProviderError $error): void
    {
        $changes = [
            'last_used_at' => now(),
            'last_error_at' => now(),
            'last_error_type' => $error->type->value,
            'last_error_note' => $error->getMessage(),
            'consecutive_failures' => $credential->consecutive_failures + 1,
        ];

        switch ($error->type) {
            case ErrorType::RateLimited:
                $changes['status'] = CredentialStatus::CoolingDown;
                $changes['available_at'] = now()->addSeconds($this->cooldown($credential, $error));
                $changes['cooldown_step'] = min($credential->cooldown_step + 1, 250);
                break;

            case ErrorType::Outage:
                // The provider, not the key — rest briefly so the next request
                // goes elsewhere instead of waiting on the same timeout.
                $changes['status'] = CredentialStatus::CoolingDown;
                $changes['available_at'] = now()->addSeconds((int) config('ai.outage_cooldown', 120));
                break;

            case ErrorType::Auth:
            case ErrorType::Model:
                // Will not fix itself; out until someone edits or retries it.
                $changes['status'] = CredentialStatus::Invalid;
                $changes['available_at'] = null;
                break;

            default:
                // Our request or its content, not the key: record, change nothing.
                unset($changes['consecutive_failures']);
        }

        AiCredential::query()
            ->whereKey($credential->id)
            ->where('status', '!=', CredentialStatus::Disabled)
            ->update($changes);
    }

    /** How long a rate-limited key rests. */
    public function cooldown(AiCredential $credential, ProviderError $error): int
    {
        $min = (int) config('ai.cooldown_min', 10);
        $max = (int) config('ai.cooldown_max', 86400);

        if ($error->retryAfter !== null && $error->retryAfter > 0) {
            return max($min, min($max, $error->retryAfter));
        }

        if ($error->daily) {
            return (int) config('ai.daily_cooldown', 21600);
        }

        $steps = (array) config('ai.cooldown_steps', [60, 300, 1800, 21600]);

        return (int) ($steps[min($credential->cooldown_step, count($steps) - 1)] ?? 60);
    }
}
