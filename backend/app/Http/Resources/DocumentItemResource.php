<?php

namespace App\Http\Resources;

use App\Models\DocumentItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DocumentItem */
class DocumentItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => (int) $this->position,
            'description' => (string) $this->description,
            'quantity' => (string) $this->quantity,
            'unit_price' => (string) $this->unit_price,
            'total' => DocumentResource::amount($this->totalCentimes()),
        ];
    }
}
