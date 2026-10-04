<?php

namespace App\AI;

/**
 * What went wrong, in the terms that decide what happens next.
 *
 * Only some of these mean "try another key": a rate limit or a dead key is
 * the key's problem, a malformed request is ours and would fail the same way
 * on every key, burning quota for nothing.
 */
enum ErrorType: string
{
    case RateLimited = 'rate_limited';
    case Auth = 'auth';
    case Model = 'model';
    case Outage = 'outage';
    case BadRequest = 'bad_request';
    case Blocked = 'blocked';

    public function rotates(): bool
    {
        return in_array($this, [self::RateLimited, self::Auth, self::Model, self::Outage], true);
    }

    public function label(): string
    {
        return match ($this) {
            self::RateLimited => 'Quota or rate limit reached',
            self::Auth => 'API key refused',
            self::Model => 'Model not available',
            self::Outage => 'Provider not responding',
            self::BadRequest => 'Request refused',
            self::Blocked => 'Blocked by the provider’s safety filter',
        };
    }
}
