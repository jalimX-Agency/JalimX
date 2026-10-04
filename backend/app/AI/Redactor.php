<?php

namespace App\AI;

/**
 * Takes anything key-shaped out of a message before it is stored, logged or
 * shown.
 *
 * Providers do not normally echo the key back, and we never put it in a URL,
 * but an error message is the one string that travels from the outside world
 * into our database and logs — so it is cleaned unconditionally.
 */
final class Redactor
{
    private const PATTERNS = [
        '/AIza[0-9A-Za-z_\-]{20,}/',          // Google
        '/gsk_[0-9A-Za-z]{20,}/',              // Groq
        '/sk-[0-9A-Za-z_\-]{16,}/',            // OpenAI-style
        '/Bearer\s+[^\s"\']+/i',
        '/([?&](key|api_key|apikey|token)=)[^&\s"\']+/i',
    ];

    public static function clean(?string $message, ?string $secret = null, int $limit = 300): string
    {
        $message = (string) $message;

        if ($secret !== null && $secret !== '') {
            $message = str_replace($secret, '[key]', $message);
        }

        $message = preg_replace(self::PATTERNS, '[key]', $message) ?? '';
        $message = trim(preg_replace('/\s+/', ' ', $message) ?? '');

        return mb_strimwidth($message, 0, $limit, '…');
    }
}
