<?php

namespace App\AI\Drivers;

use App\AI\AiRequest;
use App\AI\AiResult;
use App\Models\AiCredential;

/**
 * One provider dialect. Throws App\AI\Exceptions\ProviderError, already
 * classified and cleaned, for anything the provider refused.
 */
interface AiDriver
{
    public function generate(AiCredential $credential, AiRequest $request): AiResult;
}
