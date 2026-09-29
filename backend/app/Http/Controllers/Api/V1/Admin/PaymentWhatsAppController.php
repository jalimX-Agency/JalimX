<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Payment;
use App\Services\ClientMessenger;
use App\Support\DocumentPdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * "Nous confirmons la bonne réception de votre paiement": a payment,
 * acknowledged to the client on WhatsApp, with the invoice attached as it
 * now stands — what has been paid, and what is left.
 */
class PaymentWhatsAppController extends Controller
{
    public function __invoke(Request $request, Payment $payment): JsonResponse
    {
        $data = $request->validate([
            // Defaults to the client's own number; can be whoever paid.
            'to' => ['nullable', 'string', 'max:30'],
        ]);

        $document = $payment->document()->with('client', 'items', 'payments')->firstOrFail();
        $client = $document->client;
        $to = ClientMessenger::number($data['to'] ?? null, $client->phone);

        $currency = (string) $document->currency;
        $due = $document->totalCentimes() - $document->paidCentimes();

        try {
            ClientMessenger::make()->send(
                'payment',
                $to,
                [
                    $client->contact_name ?: $client->name,
                    self::money((int) round((float) $payment->amount * 100), $currency),
                    (string) $document->number,
                    $due > 0
                        ? 'Reste à payer : '.self::money($due, $currency).'.'
                        : 'Votre facture est désormais entièrement réglée ✔',
                ],
                DocumentPdf::render($document)->output(),
                DocumentPdf::filename($document),
            );
        } catch (RuntimeException $e) {
            report($e);

            return response()->json([
                'message' => Str::limit($e->getMessage(), 300).' Nothing was sent.',
            ], 502);
        }

        $payment->forceFill(['whatsapp_sent_at' => now()])->save();

        return response()->json([
            'data' => [
                'sent_to' => $to,
                'document' => new DocumentResource($document->fresh()->load('items', 'payments')),
            ],
        ]);
    }

    /** "6 000,00 MAD", the way a French-reading client writes it. */
    private static function money(int $centimes, string $currency): string
    {
        return number_format($centimes / 100, 2, ',', ' ').' '.$currency;
    }
}
