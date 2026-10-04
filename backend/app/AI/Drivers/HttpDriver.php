<?php

namespace App\AI\Drivers;

use App\AI\ErrorType;
use App\AI\Exceptions\ProviderError;
use App\AI\ProviderCatalog;
use App\AI\Redactor;
use App\Models\AiCredential;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * What every HTTP dialect shares: the client, and turning a refusal into a
 * classified, cleaned error.
 *
 * The key always travels in a header, never in the URL — a URL ends up in
 * exception messages, proxy logs and error trackers, a header does not.
 * Redirects are not followed: a redirect is never part of these APIs, and
 * following one would carry the key's header to wherever it pointed.
 */
abstract class HttpDriver implements AiDriver
{
    protected function client(AiCredential $credential): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->timeout((int) config('ai.timeout', 30))
            ->withOptions(['allow_redirects' => false]);
    }

    protected function baseUrl(AiCredential $credential): string
    {
        $url = ProviderCatalog::baseUrl($credential->provider, $credential->base_url);

        if ($url === null) {
            throw new ProviderError(ErrorType::BadRequest, 'This credential has no API address.');
        }

        return $url;
    }

    /** Runs the call; a network failure is an outage, not our bug. */
    protected function send(AiCredential $credential, callable $call): Response
    {
        try {
            $response = $call();
        } catch (ConnectionException $e) {
            throw new ProviderError(
                ErrorType::Outage,
                Redactor::clean('Could not reach the provider: '.$e->getMessage(), $credential->api_key),
            );
        }

        if ($response->failed()) {
            throw $this->classify($credential, $response);
        }

        return $response;
    }

    abstract protected function classify(AiCredential $credential, Response $response): ProviderError;

    /** Seconds from a Retry-After header (number or HTTP date). */
    protected function retryAfterHeader(Response $response): ?int
    {
        $value = $response->header('Retry-After');

        if ($value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (int) ceil((float) $value);
        }

        $at = strtotime($value);

        return $at ? max(0, $at - time()) : null;
    }

    /** "1m30.5s", "37s", "250ms" → seconds. */
    protected function duration(?string $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! preg_match_all('/([\d.]+)\s*(ms|h|m|s)/', $value, $parts, PREG_SET_ORDER)) {
            return is_numeric($value) ? (int) ceil((float) $value) : null;
        }

        $seconds = 0.0;
        foreach ($parts as [, $n, $unit]) {
            $seconds += (float) $n * ['h' => 3600, 'm' => 60, 's' => 1, 'ms' => 0.001][$unit];
        }

        return (int) ceil($seconds);
    }

    protected function error(AiCredential $credential, ErrorType $type, string $message, Response $response, ?int $retryAfter = null, bool $daily = false): ProviderError
    {
        return new ProviderError(
            $type,
            Redactor::clean("HTTP {$response->status()}: {$message}", $credential->api_key),
            $response->status(),
            $retryAfter,
            $daily,
        );
    }

    /** Words providers use for "you are out of quota", whatever the status. */
    protected function soundsLikeQuota(string $message): bool
    {
        return (bool) preg_match('/quota|rate.?limit|resource.?exhausted|too many requests|insufficient.?(quota|credits|balance)|credits?/i', $message);
    }

    protected function soundsDaily(string $message): bool
    {
        return (bool) preg_match('/per.?day|daily|PerDay/i', $message);
    }
}
