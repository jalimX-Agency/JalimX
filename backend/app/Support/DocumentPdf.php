<?php

namespace App\Support;

use App\Http\Resources\DocumentResource;
use App\Models\Document;
use Barryvdh\DomPDF\Facade\Pdf;

/**
 * A quote or invoice as paper — the same file whether it is opened in
 * the dashboard or sent to the client, so what the client receives is
 * exactly what was checked.
 *
 * In French, because that is the language a Moroccan client's accountant
 * reads an invoice in. A draft is rendered from the live records and marked
 * as such; an issued one is rendered from the details frozen into it, so a
 * reprint next year is the same document, not today's version of it.
 */
final class DocumentPdf
{
    public static function render(Document $document): \Barryvdh\DomPDF\PDF
    {
        $document->loadMissing('items', 'payments', 'client');

        $from = $document->issued_by ?: BillingProfile::current();
        $client = $document->client;
        $to = $document->bill_to ?: [
            'name' => $client->legal_name ?: $client->name,
            'contact_name' => $client->contact_name,
            'address' => $client->address,
            'city' => $client->city,
            'country' => $client->country,
            'ice' => $client->ice,
            'email' => $client->email,
        ];

        return Pdf::loadView('documents.pdf', [
            'document' => $document,
            'from' => $from,
            'to' => $to,
            'totals' => [
                'subtotal' => DocumentResource::amount($document->subtotalCentimes()),
                'tva' => DocumentResource::amount($document->tvaCentimes()),
                'total' => DocumentResource::amount($document->totalCentimes()),
                'paid' => DocumentResource::amount($document->paidCentimes()),
                'due' => DocumentResource::amount(
                    $document->totalCentimes() - $document->paidCentimes()
                ),
            ],
        ])
            ->setPaper('a4')
            // Only the glyphs actually used. Embedding the whole font made a
            // one-page invoice close to a megabyte.
            ->setOption('isFontSubsettingEnabled', true);
    }

    public static function filename(Document $document): string
    {
        $name = $document->number
            ?: strtoupper($document->type).'-brouillon-'.$document->id;

        return "{$name}.pdf";
    }
}
