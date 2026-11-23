<?php

namespace App\Http\Middleware;

use App\Models\Attachment;
use App\Models\Client;
use App\Models\Credential;
use App\Models\Document;
use App\Models\Engagement;
use App\Models\Payment;
use App\Models\Task;
use App\Models\WhatsAppContact;
use App\Support\ClientScope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every admin route that names a record tied to a client checks that the
 * person may reach that client. One place, so a new route cannot forget.
 *
 * Answered with 404 rather than 403: someone limited to their own clients
 * does not learn that another client's invoice 37 exists.
 */
class EnforceClientScope
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        // Assignments can change between requests; never trust a previous answer.
        ClientScope::forget();

        if (ClientScope::limited($user)) {
            foreach ($request->route()?->parameters() ?? [] as $value) {
                [$clientId, $unlinked] = self::clientOf($value);
                if ($clientId === false) {
                    continue;
                }
                abort_unless(ClientScope::allows($user, $clientId, $unlinked), 404);
            }
        }

        return $next($request);
    }

    /**
     * The client a bound model belongs to: [client id or null, permission
     * that allows "no client"], or [false, null] for anything not tied to one.
     *
     * @return array{0: int|null|false, 1: string|null}
     */
    public static function clientOf(mixed $value): array
    {
        return match (true) {
            $value instanceof Client => [$value->id, null],
            $value instanceof Engagement, $value instanceof Document, $value instanceof Credential => [$value->client_id, null],
            $value instanceof Payment => [$value->document?->client_id, null],
            $value instanceof Attachment => [$value->engagement?->client_id, null],
            $value instanceof Task => [$value->client_id ?? $value->engagement?->client_id, null],
            $value instanceof WhatsAppContact => [$value->client_id, 'inbox.unlinked'],
            default => [false, null],
        };
    }
}
