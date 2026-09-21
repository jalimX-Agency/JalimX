<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Document;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Money received against an invoice.
 *
 * Recorded as separate payments rather than a paid/unpaid switch, because
 * the arrangement here is half up front and half on delivery: what matters
 * is how much has arrived and when, not whether the invoice is "done".
 */
class PaymentController extends Controller
{
    public function store(Request $request, Document $document): JsonResponse
    {
        if ($document->type !== 'invoice') {
            throw ValidationException::withMessages([
                'amount' => 'Only an invoice can be paid. Turn this quote into one first.',
            ]);
        }

        if ($document->status === 'draft') {
            throw ValidationException::withMessages([
                'amount' => 'Issue this invoice before recording a payment against it.',
            ]);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'paid_on' => ['required', 'date'],
            'method' => ['required', Rule::in(Payment::METHODS)],
            'reference' => ['nullable', 'string', 'max:120'],
        ], [], ['paid_on' => 'date']);

        $document->payments()->create($data);

        return response()->json([
            'data' => new DocumentResource($document->fresh()->load('items', 'payments')),
        ], 201);
    }

    /** Returns the invoice, so the dashboard sees the new balance at once. */
    public function destroy(Payment $payment): JsonResponse
    {
        $document = $payment->document;
        $payment->delete();

        return response()->json([
            'data' => new DocumentResource($document->fresh()->load('items', 'payments')),
        ]);
    }
}
