<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A client as the dashboard sees it. Never public — clients only exist
 * behind auth:sanctum, and nothing on jalimx.com reads this.
 *
 * @mixin \App\Models\Client
 */
class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => (string) $this->name,
            'legal_name' => $this->legal_name,
            'ice' => $this->ice,
            'contact_name' => $this->contact_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'website' => $this->website,
            'address' => $this->address,
            'city' => $this->city,
            'country' => (string) $this->country,
            'currency' => (string) $this->currency,
            'notes' => $this->notes,
            'lead_id' => $this->lead_id,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
