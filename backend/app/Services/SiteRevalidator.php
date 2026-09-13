<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Tells the Next.js frontend to drop a cached tag.
 *
 * The marketing pages are static with a one-hour revalidate window; that window
 * is a backstop. This is what makes an edit show up straight away.
 *
 * Failures are logged and swallowed on purpose: the frontend being down must
 * never stop someone saving their work in the dashboard. Worst case the edit
 * appears when the hour is up.
 */
class SiteRevalidator
{
    /** @param  list<string>  $tags */
    public function flush(array $tags): void
    {
        $url = config('services.frontend.url');
        $secret = config('services.frontend.revalidate_secret');

        if (blank($url) || blank($secret)) {
            return;
        }

        try {
            $response = Http::timeout(3)
                ->withHeaders(['X-Revalidate-Secret' => $secret])
                ->post(rtrim($url, '/').'/api/revalidate', ['tags' => $tags]);

            if ($response->failed()) {
                Log::warning('Revalidation rejected by the frontend.', [
                    'tags' => $tags,
                    'status' => $response->status(),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Revalidation request failed.', [
                'tags' => $tags,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
