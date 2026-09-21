<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'name', 'legal_name', 'ice',
        'contact_name', 'email', 'phone', 'website',
        'address', 'city', 'country', 'currency',
        'notes', 'lead_id',
    ];

    /** The work done for them, newest first. */
    public function engagements(): HasMany
    {
        return $this->hasMany(Engagement::class)->latest('id');
    }

    /** Their quotes and invoices, newest first. */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class)->latest('id');
    }

    /** The enquiry this client came from, when they came from one. */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }
}
