<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class WhatsAppContact extends Model
{
    protected $table = 'whatsapp_contacts';

    protected $fillable = ['wa_id', 'name', 'client_id', 'last_message_at', 'last_inbound_at', 'unread'];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'last_inbound_at' => 'datetime',
            'unread' => 'integer',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WhatsAppMessage::class, 'contact_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(WhatsAppMessage::class, 'contact_id')->latestOfMany('sent_at');
    }

    /**
     * Until when a free reply is allowed: 24 hours after they last wrote.
     * After that WhatsApp accepts only an approved template.
     */
    public function replyWindowEndsAt(): ?Carbon
    {
        return $this->last_inbound_at?->copy()->addDay();
    }

    public function canReply(): bool
    {
        return (bool) $this->replyWindowEndsAt()?->isFuture();
    }
}
