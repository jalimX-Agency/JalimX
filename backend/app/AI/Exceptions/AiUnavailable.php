<?php

namespace App\AI\Exceptions;

use RuntimeException;

/** No key could answer: none set up, all resting, or every one failed. */
class AiUnavailable extends RuntimeException
{
    /** @param list<string> $reasons one line per key tried, already safe to show */
    public function __construct(string $message, public readonly array $reasons = [])
    {
        parent::__construct($message);
    }
}
