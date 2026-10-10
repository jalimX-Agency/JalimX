<?php

namespace App\Http\Resources;

use App\Http\Controllers\Api\V1\Admin\LeadReplyController;
use App\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A lead as the dashboard sees it. Only ever returned behind auth:sanctum;
 * the IP stays out even here — it is kept for abuse checks, not for reading.
 *
 * @mixin Lead
 */
class LeadResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'company' => $this->company,
            'service_interest' => $this->service_interest,
            'budget_range' => $this->budget_range,
            'message' => $this->message,
            'note' => $this->note,
            'status' => $this->status,
            'locale' => $this->locale,
            'source' => $this->source,
            'is_read' => $this->read_at !== null,
            /*
             * Whether this enquiry already became a client, so the dashboard
             * can link to them instead of offering to convert a second time.
             */
            'client' => $this->whenLoaded('client', fn () => $this->client ? [
                'id' => $this->client->id,
                'name' => (string) $this->client->name,
            ] : null),
            /*
             * The number the email's WhatsApp button points to, so the
             * dashboard can show what it is about to put in the email.
             */
            'reply_whatsapp' => ($n = LeadReplyController::agencyWhatsApp()) ? \App\Support\PhoneNumber::display($n) : null,
            'replies' => $this->whenLoaded('replies', fn () => $this->replies->map(fn ($r) => [
                'id' => $r->id,
                'sent_to' => $r->sent_to,
                'subject' => $r->subject,
                'body' => $r->body,
                'with_whatsapp' => $r->with_whatsapp,
                'created_at' => $r->created_at?->toIso8601String(),
            ])->values()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
