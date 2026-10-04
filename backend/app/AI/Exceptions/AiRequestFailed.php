<?php

namespace App\AI\Exceptions;

use App\AI\ErrorType;
use RuntimeException;

/**
 * The request itself was refused (malformed, too long, or blocked by a safety
 * filter). Another key would refuse it too, so no rotation happened.
 */
class AiRequestFailed extends RuntimeException
{
    public function __construct(public readonly ErrorType $type, string $message)
    {
        parent::__construct($message);
    }
}
