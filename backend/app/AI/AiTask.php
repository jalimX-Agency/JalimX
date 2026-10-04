<?php

namespace App\AI;

/**
 * One thing the dashboard asks AI to do. Knows its prompt and how to read
 * the answer; knows nothing about which provider will answer.
 */
interface AiTask
{
    /** The name used to ask for it and to log it, e.g. `text_assist`. */
    public static function name(): string;

    /** Validated input in, a provider-neutral request out. */
    public function build(array $input): AiRequest;

    /** The provider's raw text in, what the caller gets back out. */
    public function parse(AiResult $result, array $input): mixed;
}
