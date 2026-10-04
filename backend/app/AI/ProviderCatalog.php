<?php

namespace App\AI;

use App\AI\Drivers\AiDriver;
use App\AI\Drivers\GeminiDriver;
use App\AI\Drivers\OpenAiCompatibleDriver;
use App\Models\AiCredential;
use Illuminate\Contracts\Encryption\DecryptException;

/**
 * Every provider the pool knows how to talk to.
 *
 * Most of them speak OpenAI's chat-completions dialect, so they share one
 * driver and differ only by address. Adding one of those is a line here;
 * `custom` takes any OpenAI-compatible address typed in the dashboard (an
 * aggregator such as codecraftapi.com, a self-hosted gateway…). Only a
 * provider with its own dialect needs a driver of its own.
 *
 * The model lists are suggestions for the form, not a whitelist: providers
 * add and retire models faster than a deploy, so any name can be typed.
 */
final class ProviderCatalog
{
    /** @return array<string, array{name: string, driver: class-string<AiDriver>, base_url: ?string, models: list<string>, keys_at: ?string}> */
    public static function all(): array
    {
        return [
            'gemini' => [
                'name' => 'Google Gemini',
                'driver' => GeminiDriver::class,
                'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
                'models' => ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
                'keys_at' => 'https://aistudio.google.com/apikey',
            ],
            'groq' => [
                'name' => 'Groq',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => 'https://api.groq.com/openai/v1',
                'models' => ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
                'keys_at' => 'https://console.groq.com/keys',
            ],
            'openrouter' => [
                'name' => 'OpenRouter',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => 'https://openrouter.ai/api/v1',
                'models' => ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free'],
                'keys_at' => 'https://openrouter.ai/settings/keys',
            ],
            'mistral' => [
                'name' => 'Mistral',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => 'https://api.mistral.ai/v1',
                'models' => ['mistral-small-latest', 'mistral-large-latest'],
                'keys_at' => 'https://console.mistral.ai/api-keys',
            ],
            'deepseek' => [
                'name' => 'DeepSeek',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => 'https://api.deepseek.com/v1',
                'models' => ['deepseek-chat'],
                'keys_at' => 'https://platform.deepseek.com/api_keys',
            ],
            'cerebras' => [
                'name' => 'Cerebras',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => 'https://api.cerebras.ai/v1',
                'models' => ['llama-3.3-70b', 'llama3.1-8b'],
                'keys_at' => 'https://cloud.cerebras.ai',
            ],
            'custom' => [
                'name' => 'Other (OpenAI-compatible)',
                'driver' => OpenAiCompatibleDriver::class,
                'base_url' => null,
                'models' => [],
                'keys_at' => null,
            ],
        ];
    }

    public static function exists(string $provider): bool
    {
        return array_key_exists($provider, self::all());
    }

    /** The address to call: the catalog's, or the one typed for `custom`. */
    public static function baseUrl(string $provider, ?string $typed): ?string
    {
        $fixed = self::all()[$provider]['base_url'] ?? null;

        return rtrim((string) ($fixed ?? $typed), '/') ?: null;
    }

    public static function driver(string $provider): AiDriver
    {
        $class = self::all()[$provider]['driver'] ?? null;

        if ($class === null) {
            throw new \InvalidArgumentException("Unknown AI provider [{$provider}].");
        }

        return app($class);
    }

    /**
     * Runs a driver call, turning a key that can no longer be decrypted
     * (APP_KEY changed since it was saved) into a refused key — so the pool
     * moves on and the dashboard says to enter it again — instead of an
     * error that fails every request.
     */
    public static function call(AiCredential $credential, AiRequest $request): AiResult
    {
        try {
            return self::driver($credential->provider)->generate($credential, $request);
        } catch (DecryptException) {
            throw new Exceptions\ProviderError(
                ErrorType::Auth,
                'The stored key can no longer be decrypted (APP_KEY changed since it was saved). Enter the key again.',
            );
        }
    }

    public static function name(string $provider): string
    {
        return self::all()[$provider]['name'] ?? $provider;
    }
}
