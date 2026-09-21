<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Support\BillingProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

/**
 * The document as paper.
 *
 * In French, because that is the language a Moroccan client's accountant
 * reads an invoice in. A draft is rendered from the live records and marked
 * as such; an issued one is rendered from the details frozen into it, so a
 * reprint next year is the same document, not today's version of it.
 */
class DocumentPdfController extends Controller
{
    public function __invoke(Document $document): Response
    {
        // Checked here rather than by middleware: see the note on the route.
        abort_unless(Auth::guard('web')->check(), 403);

        $document->load('items', 'payments', 'client');

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

        $pdf = Pdf::loadView('documents.pdf', [
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
        ])->setPaper('a4');

        $name = $document->number
            ?: strtoupper($document->type).'-brouillon-'.$document->id;

        // Inline: the dashboard opens this in a tab to check it before it is
        // sent, and a download that must then be found in a folder is worse.
        return $pdf->stream("$name.pdf");
    }
}
