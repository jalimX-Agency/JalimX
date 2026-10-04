<?php

namespace App\AI;

/** What a task asks for, in no provider's dialect. */
final class AiRequest
{
    public function __construct(
        public readonly string $system,
        public readonly string $prompt,
        public readonly int $maxTokens = 512,
        public readonly float $temperature = 0.7,
        public readonly bool $json = false,
    ) {}
}
