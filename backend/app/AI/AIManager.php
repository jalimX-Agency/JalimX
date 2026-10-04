<?php

namespace App\AI;

use App\AI\Exceptions\AiRequestFailed;
use App\AI\Exceptions\AiUnavailable;
use App\AI\Exceptions\ProviderError;
use App\AI\Tasks\TextAssist;
use App\Models\AiCredential;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The one door to AI.
 *
 * Features ask for a task by name; this picks the key, calls the provider
 * through its driver, and moves on to the next key when the failure is the
 * key's (quota, refused key, missing model, provider down). A failure that is
 * the request's own — malformed, too long, blocked by a safety filter — stops
 * at once: every other key would refuse it the same way, and each try would
 * spend someone's free quota for nothing.
 *
 * Each key is tried at most once per request. Nothing here retries the same
 * key; a resting key comes back on its own when its `available_at` passes.
 */
class AIManager
{
    /** @var array<string, class-string<AiTask>> */
    private const TASKS = [
        'text_assist' => TextAssist::class,
    ];

    public function __construct(private readonly CredentialPool $pool) {}

    /**
     * @param  array{task: string, input: array}  $job
     * @return array{output: mixed, result: AiResult}
     */
    public function generate(array $job, ?int $userId = null): array
    {
        $class = self::TASKS[$job['task']] ?? throw new \InvalidArgumentException("Unknown AI task [{$job['task']}].");
        $task = app($class);

        $result = $this->complete($task->build($job['input']), $class::name(), $userId);

        return ['output' => $task->parse($result, $job['input']), 'result' => $result];
    }

    /** Runs one provider-neutral request through the pool. */
    public function complete(AiRequest $request, string $task, ?int $userId = null): AiResult
    {
        $candidates = $this->pool->candidates()->take(max(1, (int) config('ai.max_attempts', 5)));

        if ($candidates->isEmpty()) {
            throw new AiUnavailable($this->nothingAvailable());
        }

        $reasons = [];

        foreach ($candidates as $credential) {
            $started = hrtime(true);

            try {
                $result = ProviderCatalog::driver($credential->provider)->generate($credential, $request);
            } catch (ProviderError $error) {
                $this->log($credential, $task, $userId, $started, $error);

                if (! $error->type->rotates()) {
                    // The request's fault, not the key's: record it on the
                    // key for the dashboard, but the key stays as it was.
                    $this->pool->failed($credential, $error);

                    throw new AiRequestFailed($error->type, $error->type->label().'.');
                }

                $this->pool->failed($credential, $error);
                $reasons[] = "{$credential->label}: {$error->type->label()}";

                continue;
            }

            $latency = $this->elapsed($started);
            $this->pool->succeeded($credential);
            $this->log($credential, $task, $userId, $started, null, $result);

            return $result->withSource($credential, $latency);
        }

        throw new AiUnavailable('No AI provider could answer right now.', $reasons);
    }

    /** Why nothing could be tried: none set up, or all resting until when. */
    private function nothingAvailable(): string
    {
        if (! AiCredential::query()->exists()) {
            return 'No AI provider is set up yet. Add an API key in Settings → AI providers.';
        }

        $next = AiCredential::query()
            ->where('status', CredentialStatus::CoolingDown)
            ->min('available_at');

        return $next
            ? 'Every AI key is resting after hitting its limit. The first one is back at '.Carbon::parse($next)->format('H:i').'.'
            : 'Every AI key is disabled or invalid. Check Settings → AI providers.';
    }

    private function elapsed(int $started): int
    {
        return (int) round((hrtime(true) - $started) / 1e6);
    }

    private function log(AiCredential $credential, string $task, ?int $userId, int $started, ?ProviderError $error, ?AiResult $result = null): void
    {
        // A log that cannot be written must not lose the user their answer.
        try {
            DB::table('ai_requests')->insert([
                'ai_credential_id' => $credential->id,
                'user_id' => $userId,
                'task' => mb_substr($task, 0, 40),
                'outcome' => $error ? 'error' : 'ok',
                'error_type' => $error?->type->value,
                'latency_ms' => $this->elapsed($started),
                'tokens_in' => $result?->tokensIn,
                'tokens_out' => $result?->tokensOut,
                'created_at' => now(),
            ]);
        } catch (\Throwable) {
            //
        }
    }
}
