<?php

namespace App\Http\Resources;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A quote or invoice as the dashboard sees it.
 *
 * Every amount is a decimal string. Sent as a number, money arrives in
 * JavaScript as a float, and a float is the one type an invoice must not be.
 *
 * @mixin Document
 */
class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $subtotal = $this->subtotalCentimes();
        $total = $this->totalCentimes();
        $paid = $this->paidCentimes();

        return [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'engagement_id' => $this->engagement_id,
            'type' => (string) $this->type,
            'status' => (string) $this->status,
            'number' => $this->number,
            'issue_date' => $this->issue_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'currency' => (string) $this->currency,
            'tva_rate' => (string) $this->tva_rate,
            'subject' => $this->subject,
            'notes' => $this->notes,
            'terms' => $this->terms,

            'items' => DocumentItemResource::collection($this->whenLoaded('items')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),

            'totals' => [
                'subtotal' => self::amount($subtotal),
                'tva' => self::amount($this->tvaCentimes()),
                'total' => self::amount($total),
                'paid' => self::amount($paid),
                'due' => self::amount($total - $paid),
            ],

            /*
             * Worked out here, not stored: "paid" is a fact about the
             * payments, and a column saying otherwise would be believed.
             */
            'settled' => $total > 0 && $paid >= $total,
            'overdue' => $this->type === 'invoice'
                && $this->status === 'sent'
                && $paid < $total
                && $this->due_date !== null
                && $this->due_date->isPast(),
            'editable' => $this->isEditable(),

            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /** Centimes back to the decimal string the dashboard and the PDF print. */
    public static function amount(int $centimes): string
    {
        return number_format($centimes / 100, 2, '.', '');
    }
}
