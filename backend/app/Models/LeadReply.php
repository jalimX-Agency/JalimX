<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An email answer sent to an enquiry from the dashboard. */
class LeadReply extends Model
{
    protected $fillable = ['lead_id', 'user_id', 'sent_to', 'subject', 'body', 'with_whatsapp'];

    protected function casts(): array
    {
        return ['with_whatsapp' => 'boolean'];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
