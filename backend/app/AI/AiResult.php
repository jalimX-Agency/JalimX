<?php

namespace App\AI;

use App\Models\AiCredential;

/** What came back, and from where — never with the key. */
final class AiResult
{
    public function __construct(
        public readonly string $text,
        public readonly ?int $tokensIn = null,
        public readonly ?int $tokensOut = null,
        public readonly ?int $credentialId = null,
        public readonly ?string $credentialLabel = null,
        public readonly ?string $provider = null,
        public readonly ?string $model = null,
        public readonly ?int $latencyMs = null,
    ) {}

    public function withSource(AiCredential $credential, int $latencyMs): self
    {
        return new self(
            $this->text, $this->tokensIn, $this->tokensOut,
            $credential->id, $credential->label, $credential->provider, $credential->model, $latencyMs,
        );
    }
}
