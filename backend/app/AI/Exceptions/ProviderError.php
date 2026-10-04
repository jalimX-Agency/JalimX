<?php

namespace App\AI\Exceptions;

use App\AI\ErrorType;
use RuntimeException;

/**
 * A provider said no, already classified. The message has been through the
 * Redactor; it is safe to store and to show.
 */
class ProviderError extends RuntimeException
{
    public function __construct(
        public readonly ErrorType $type,
        string $message,
        public readonly ?int $status = null,
        /** Seconds the provider asked us to wait, when it said. */
        public readonly ?int $retryAfter = null,
        /** The quota that ran out is a daily one. */
        public readonly bool $daily = false,
    ) {
        parent::__construct($message);
    }
}
