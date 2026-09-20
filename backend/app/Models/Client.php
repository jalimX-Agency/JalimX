<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Client extends Model
{
    protected $fillable = [
        'name', 'legal_name', 'ice',
        'contact_name', 'email', 'phone', 'website',
        'address', 'city', 'country', 'currency',
        'notes', 'lead_id',
    ];

    /** The enquiry this client came from, when they came from one. */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }
}
