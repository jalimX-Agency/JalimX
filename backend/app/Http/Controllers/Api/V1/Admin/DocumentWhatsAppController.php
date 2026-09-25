<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Services\ClientMessenger;
use App\Support\DocumentPdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * An issued invoice, sent to the client on WhatsApp with its PDF — the
 * same file the dashboard opens.
 */
class DocumentWhatsAppController extends Controller
{
    public function __invoke(Request $request, Document $document): JsonResponse
    {
        $data = $request->validate([
            // Defaults to the client's own number; can be the person you
            // actually deal with instead.
            'to' => ['nullable', 'string', 'max:30'],
        ]);

        $document->load('client', 'items', 'payments');

        if ($document->type !== 'invoice' || $document->status !== 'sent' || ! $document->number) {
            throw ValidationException::withMessages([
                'document' => 'Only an issued invoice can be sent. Issue it first.',
            ]);
        }

        $client = $document->client;
        $to = ClientMessenger::number($data['to'] ?? null, $client->phone);

        $due = $document->totalCentimes() - $document->paidCentimes();
        $currency = (string) $document->currency;

        try {
            ClientMessenger::make()->send(
                'invoice',
                $to,
                [
                    $client->contact_name ?: $client->name,
                    $document->number,
                    $due > 0 ? self::money($due, $currency) : 'aucun — facture réglée ✔',
                    $document->due_date?->format('d/m/Y') ?? 'à réception',
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

        return response()->json(['data' => ['sent_to' => $to]]);
    }

    /** "6 000,00 MAD", the way a French-reading client writes it. */
    private static function money(int $centimes, string $currency): string
    {
        return number_format($centimes / 100, 2, ',', ' ').' '.$currency;
    }
}
