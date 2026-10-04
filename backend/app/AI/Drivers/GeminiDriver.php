<?php

namespace App\AI\Drivers;

use App\AI\AiRequest;
use App\AI\AiResult;
use App\AI\ErrorType;
use App\AI\Exceptions\ProviderError;
use App\Models\AiCredential;
use Illuminate\Http\Client\Response;

/**
 * Google's Generative Language API (Gemini).
 *
 * The key goes in the `x-goog-api-key` header. The API also accepts it as
 * `?key=` in the URL, which is how most examples show it — and how it ends up
 * in logs and exception messages. Not here.
 */
class GeminiDriver extends HttpDriver
{
    public function generate(AiCredential $credential, AiRequest $request): AiResult
    {
        $config = [
            'maxOutputTokens' => $request->maxTokens,
            'temperature' => $request->temperature,
        ];

        if ($request->json) {
            $config['responseMimeType'] = 'application/json';
        }

        /*
         * The 2.5 Flash models "think" before answering and bill it as output:
         * a short answer can come back empty because the budget went on
         * thinking. Short writing help needs none of it. Pro cannot turn it
         * off, so it is left alone there.
         */
        if (str_contains($credential->model, 'flash')) {
            $config['thinkingConfig'] = ['thinkingBudget' => 0];
        }

        $model = rawurlencode($credential->model);

        $response = $this->send($credential, fn () => $this->client($credential)
            ->withHeaders(['x-goog-api-key' => $credential->api_key])
            ->post($this->baseUrl($credential)."/models/{$model}:generateContent", [
                'systemInstruction' => ['parts' => [['text' => $request->system]]],
                'contents' => [['role' => 'user', 'parts' => [['text' => $request->prompt]]]],
                'generationConfig' => $config,
            ]));

        if ($reason = $response->json('promptFeedback.blockReason')) {
            throw new ProviderError(ErrorType::Blocked, "The request was blocked ({$reason}).");
        }

        $candidate = $response->json('candidates.0') ?? [];

        if (in_array($candidate['finishReason'] ?? null, ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII'], true)) {
            throw new ProviderError(ErrorType::Blocked, 'The answer was blocked by the safety filter.');
        }

        $text = collect($candidate['content']['parts'] ?? [])
            ->reject(fn ($part) => $part['thought'] ?? false)
            ->pluck('text')
            ->implode('');

        return new AiResult(
            text: $text,
            tokensIn: $response->json('usageMetadata.promptTokenCount'),
            tokensOut: $response->json('usageMetadata.candidatesTokenCount'),
        );
    }

    protected function classify(AiCredential $credential, Response $response): ProviderError
    {
        $status = $response->status();
        $state = (string) $response->json('error.status');
        $message = (string) ($response->json('error.message') ?? $response->reason());
        $reasons = collect($response->json('error.details') ?? [])->pluck('reason')->filter()->all();

        // An invalid key comes back as 400 INVALID_ARGUMENT, not 401 — it has
        // to be recognised by its reason, or it would look like our bug.
        if (in_array('API_KEY_INVALID', $reasons, true) || $status === 401
            || $state === 'PERMISSION_DENIED' || $state === 'UNAUTHENTICATED') {
            return $this->error($credential, ErrorType::Auth, $message, $response);
        }

        if ($status === 429 || $state === 'RESOURCE_EXHAUSTED' || $this->soundsLikeQuota($message)) {
            $delay = collect($response->json('error.details') ?? [])
                ->first(fn ($d) => str_ends_with((string) ($d['@type'] ?? ''), 'RetryInfo'))['retryDelay'] ?? null;

            return $this->error(
                $credential, ErrorType::RateLimited, $message, $response,
                $this->duration($delay) ?? $this->retryAfterHeader($response),
                $this->soundsDaily($message.' '.json_encode($response->json('error.details'))),
            );
        }

        if ($status === 404 || $state === 'NOT_FOUND') {
            return $this->error($credential, ErrorType::Model, $message, $response);
        }

        if ($status >= 500 || $status === 408) {
            return $this->error($credential, ErrorType::Outage, $message, $response);
        }

        return $this->error($credential, ErrorType::BadRequest, $message, $response);
    }
}
