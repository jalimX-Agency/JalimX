<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Checks a Cloudflare Turnstile token: that a real browser passed the check,
 * and passed it on this site.
 *
 * The contact form is the one public write, and nothing about a form that
 * anyone on the internet can post to stops a script from posting to it a
 * thousand times. The widget on the page gives each visitor a one-time token;
 * this asks Cloudflare whether the token is genuine and unspent. Cloudflare
 * also says which hostname the token was issued on, and a token made on
 * someone else's page, with someone else's widget, is not welcome here.
 *
 * Off until TURNSTILE_SECRET_KEY is set, so this can ship before the widget
 * exists without turning every enquiry away.
 */
final class Turnstile
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public const PASSED = 'passed';

    public const FAILED = 'failed';

    /** Cloudflare could not be asked. Not the visitor's fault, so not held against them. */
    public const UNAVAILABLE = 'unavailable';

    public static function enabled(): bool
    {
        return filled(config('services.turnstile.secret'));
    }

    /** @return self::PASSED|self::FAILED|self::UNAVAILABLE */
    public function check(?string $token, ?string $ip = null): string
    {
        if (blank($token) || strlen($token) > 2048) {
            return self::FAILED;
        }

        try {
            $response = Http::asForm()
                ->timeout(5)
                ->post(self::VERIFY_URL, array_filter([
                    'secret' => config('services.turnstile.secret'),
                    'response' => $token,
                    'remoteip' => $ip,
                ]));
        } catch (Throwable $e) {
            report($e);

            return self::UNAVAILABLE;
        }

        // A 5xx is Cloudflare having a bad day; a 4xx or a plain "no" is an answer.
        if ($response->serverError()) {
            report(new \RuntimeException('Turnstile siteverify answered '.$response->status().'.'));

            return self::UNAVAILABLE;
        }

        if ($response->json('success') !== true) {
            return self::FAILED;
        }

        $hostnames = (array) config('services.turnstile.hostnames');

        if ($hostnames !== [] && ! in_array($response->json('hostname'), $hostnames, true)) {
            return self::FAILED;
        }

        return self::PASSED;
    }
}
