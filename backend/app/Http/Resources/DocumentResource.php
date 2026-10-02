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
            // The month a retainer's invoice covers, as its first day. It
            // is what lets the dashboard say which months are still owed.
            'period' => $this->period?->toDateString(),
            'currency' => (string) $this->currency,
            'tva_rate' => (string) $this->tva_rate,
            'discount_type' => $this->discount_type,
            'discount_value' => $this->discount_value !== null ? (string) $this->discount_value : null,
            'discount_label' => $this->discount_label,
            'subject' => $this->subject,
            'notes' => $this->notes,
            'terms' => $this->terms,

            'items' => DocumentItemResource::collection($this->whenLoaded('items')),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),

            'totals' => [
                // gross − discount = subtotal, the untaxed total VAT is on.
                'gross' => self::amount($this->grossCentimes()),
                'discount' => self::amount($this->discountCentimes()),
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
            // Issued before the client's details were last changed: the
            // PDF still shows the old ones until they are copied in.
            'client_details_changed' => $this->clientDetailsChanged(),

            // Sent on WhatsApp, and whether it arrived and was opened.
            'whatsapp' => $this->whenLoaded('latestWhatsApp', fn () => $this->latestWhatsApp ? [
                'status' => (string) $this->latestWhatsApp->status,
                'error' => $this->latestWhatsApp->error,
                'sent_at' => $this->latestWhatsApp->sent_at?->toIso8601String(),
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /** Centimes back to the decimal string the dashboard and the PDF print. */
    public static function amount(int $centimes): string
    {
        return number_format($centimes / 100, 2, '.', '');
    }
}
