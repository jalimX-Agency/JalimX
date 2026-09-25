<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\WhatsAppInbox;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Throwable;

/**
 * Where Meta posts what happens on the agency's WhatsApp number: messages
 * people send, and receipts for the ones we sent.
 *
 * Public by necessity, so nothing is believed until the signature is
 * checked: Meta signs the raw body with the app secret, and a request that
 * does not carry that signature is refused before it is even parsed.
 */
class WhatsAppWebhookController extends Controller
{
    /** Meta's one-time check that the URL is ours, when the webhook is set up. */
    public function verify(Request $request): Response
    {
        $token = (string) config('services.whatsapp.verify_token');

        abort_unless(
            $token !== ''
                && $request->query('hub_mode') === 'subscribe'
                && hash_equals($token, (string) $request->query('hub_verify_token')),
            403,
        );

        return response((string) $request->query('hub_challenge'), 200, ['Content-Type' => 'text/plain']);
    }

    public function receive(Request $request): Response
    {
        $secret = (string) config('services.whatsapp.app_secret');
        $expected = 'sha256='.hash_hmac('sha256', $request->getContent(), $secret);

        abort_unless(
            $secret !== '' && hash_equals($expected, (string) $request->header('X-Hub-Signature-256')),
            403,
        );

        $inbox = WhatsAppInbox::make();

        foreach ($request->input('entry', []) as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                if (($change['field'] ?? null) !== 'messages') {
                    continue;
                }

                /*
                 * One bad message must not cost the rest of the batch, nor
                 * make Meta retry the lot: it is logged, and the answer is
                 * still 200. Meta resends anything it did not get a 200 for,
                 * which is how a single broken payload becomes a storm.
                 */
                try {
                    $inbox->handle($change['value'] ?? []);
                } catch (Throwable $e) {
                    report($e);
                }
            }
        }

        return response('', 200);
    }
}
