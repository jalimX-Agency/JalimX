<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentItem extends Model
{
    protected $fillable = ['position', 'description', 'quantity', 'unit_price'];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'decimal:2',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    /**
     * Rounded once, at the line: rounding the whole invoice instead lets a
     * half-centime per line add up to a total nobody can reproduce.
     */
    public function totalCentimes(): int
    {
        return (int) round((float) $this->quantity * (float) $this->unit_price * 100);
    }
}
