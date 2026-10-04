<?php

namespace App\AI\Drivers;

use App\AI\AiRequest;
use App\AI\AiResult;
use App\AI\ErrorType;
use App\AI\Exceptions\ProviderError;
use App\Models\AiCredential;
use Illuminate\Http\Client\Response;

/**
 * The chat-completions dialect most providers speak: Groq, OpenRouter,
 * Mistral, DeepSeek, Cerebras, and any compatible gateway at a custom address.
 *
 * Providers word their errors differently, so classification leans on the
 * status first and the wording second.
 */
class OpenAiCompatibleDriver extends HttpDriver
{
    public function generate(AiCredential $credential, AiRequest $request): AiResult
    {
        $body = [
            'model' => $credential->model,
            'messages' => [
                ['role' => 'system', 'content' => $request->system],
                ['role' => 'user', 'content' => $request->prompt],
            ],
            'max_tokens' => $request->maxTokens,
            'temperature' => $request->temperature,
        ];

        if ($request->json) {
            $body['response_format'] = ['type' => 'json_object'];
        }

        $response = $this->send($credential, fn () => $this->client($credential)
            ->withToken($credential->api_key)
            ->withHeaders($this->extraHeaders($credential))
            ->post($this->baseUrl($credential).'/chat/completions', $body));

        // Some gateways answer 200 with an error body.
        if ($response->json('error')) {
            throw $this->classify($credential, $response);
        }

        $choice = $response->json('choices.0') ?? [];

        if (($choice['finish_reason'] ?? null) === 'content_filter') {
            throw new ProviderError(ErrorType::Blocked, 'The answer was blocked by the safety filter.');
        }

        $content = $choice['message']['content'] ?? '';

        return new AiResult(
            text: is_string($content) ? $content : '',
            tokensIn: $response->json('usage.prompt_tokens'),
            tokensOut: $response->json('usage.completion_tokens'),
        );
    }

    /** OpenRouter ranks and attributes apps by these; harmless elsewhere. */
    private function extraHeaders(AiCredential $credential): array
    {
        return $credential->provider === 'openrouter'
            ? ['HTTP-Referer' => config('app.url'), 'X-Title' => 'JalimX']
            : [];
    }

    protected function classify(AiCredential $credential, Response $response): ProviderError
    {
        $status = $response->status();
        $error = $response->json('error');
        $message = is_array($error)
            ? (string) ($error['message'] ?? json_encode($error))
            : (string) ($error ?? $response->json('message') ?? $response->json('detail') ?? $response->reason());
        $code = is_array($error) ? strtolower((string) ($error['code'] ?? $error['type'] ?? '')) : '';

        if ($status === 401 || str_contains($code, 'invalid_api_key') || preg_match('/invalid.{0,10}(api.?)?key|unauthori[sz]ed|incorrect api key/i', $message)) {
            return $this->error($credential, ErrorType::Auth, $message, $response);
        }

        // 402 is OpenRouter's "out of credits": a quota, just a slower one.
        if ($status === 429 || $status === 402 || str_contains($code, 'quota') || str_contains($code, 'rate_limit') || $this->soundsLikeQuota($message)) {
            $retry = $this->retryAfterHeader($response)
                ?? $this->duration($response->header('x-ratelimit-reset-requests') ?: null)
                ?? $this->duration($response->header('x-ratelimit-reset-tokens') ?: null);

            return $this->error($credential, ErrorType::RateLimited, $message, $response, $retry, $status === 402 || $this->soundsDaily($message));
        }

        if ($status === 403) {
            return $this->error($credential, ErrorType::Auth, $message, $response);
        }

        if ($status === 404 || str_contains($code, 'model_not_found')
            || preg_match('/model.{0,40}(not found|does not exist|not available|decommissioned|unsupported|no endpoints)/i', $message)) {
            return $this->error($credential, ErrorType::Model, $message, $response);
        }

        if ($status >= 500 || $status === 408) {
            return $this->error($credential, ErrorType::Outage, $message, $response);
        }

        return $this->error($credential, ErrorType::BadRequest, $message, $response);
    }
}
