<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets the public read endpoints answer only the site itself.
 *
 * The marketing site reads its content (services, projects, testimonials,
 * settings) from this API on its own server. Those endpoints used to answer
 * anyone who asked, and once handed back more than they should have. Now a
 * request has to carry a key that only the site's server can make.
 *
 * The key is not a new secret to store and rotate: it is derived from
 * REVALIDATE_SECRET, which the site and this API already share, with HMAC. The
 * result cannot be turned back into the secret, so a leaked key opens these
 * reads and nothing else. The site never sends it from a browser — the secret
 * does not exist there.
 *
 * Off until SITE_API_ENFORCE is set, so that this can be deployed before the
 * site is sending the header without cutting the site off from its content.
 *
 * What this cannot do: anything the site shows is public by nature, and
 * someone who copies a page has the content. It stops the endpoints from being
 * read directly, listed, or scraped as raw JSON.
 */
class RequireSiteKey
{
    /** The same message for every refusal, so a wrong key and no key look alike. */
    private const REFUSAL = ['message' => 'Unauthorized.'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('services.frontend.enforce_site_key')) {
            return $next($request);
        }

        $secret = (string) config('services.frontend.revalidate_secret');
        $given = (string) $request->header('X-Site-Key');

        // Enforcing with no secret to check against would let nothing in, which
        // is the safe failure — and the log says why.
        if ($secret === '') {
            report(new \RuntimeException('SITE_API_ENFORCE is on but REVALIDATE_SECRET is not set.'));

            return response()->json(self::REFUSAL, 401);
        }

        if (! hash_equals(self::token($secret), $given)) {
            return response()->json(self::REFUSAL, 401);
        }

        return $next($request);
    }

    /** What the site sends. Mirrored in frontend/lib/api/client.ts. */
    public static function token(string $secret): string
    {
        return hash_hmac('sha256', 'jalimx-site-api-v1', $secret);
    }
}
