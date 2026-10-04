<?php

namespace App\AI;

use App\AI\Exceptions\ProviderError;
use App\Models\AiCredential;

/**
 * "Test connection": one tiny request with this key and model, read as three
 * answers — is the key accepted, is the model there, did a request go through.
 *
 * One generation call rather than listing models first: it is the only check
 * that every provider and every compatible gateway supports, and it costs a
 * single request of quota.
 */
class ConnectionTester
{
    /**
     * @return array{ok: bool, error_type: ?string, message: string, checks: list<array{label: string, ok: ?bool}>, latency_ms: ?int}
     */
    public function test(AiCredential $credential): array
    {
        $started = hrtime(true);

        try {
            ProviderCatalog::driver($credential->provider)->generate(
                $credential,
                new AiRequest(
                    system: 'Reply with the single word: ok',
                    prompt: 'ok',
                    maxTokens: 16,
                    temperature: 0,
                ),
            );
        } catch (ProviderError $error) {
            $type = $error->type;

            return [
                'ok' => false,
                'error_type' => $type->value,
                'message' => $error->getMessage(),
                'checks' => [
                    ['label' => 'API key accepted', 'ok' => $type === ErrorType::Auth ? false : ($type === ErrorType::Outage ? null : true)],
                    ['label' => 'Model available', 'ok' => match ($type) {
                        ErrorType::Model => false,
                        ErrorType::Auth, ErrorType::Outage => null,
                        default => true,
                    }],
                    ['label' => 'Request successful', 'ok' => false],
                ],
                'latency_ms' => null,
            ];
        }

        return [
            'ok' => true,
            'error_type' => null,
            'message' => 'The provider answered.',
            'checks' => [
                ['label' => 'API key accepted', 'ok' => true],
                ['label' => 'Model available', 'ok' => true],
                ['label' => 'Request successful', 'ok' => true],
            ],
            'latency_ms' => (int) round((hrtime(true) - $started) / 1e6),
        ];
    }
}
