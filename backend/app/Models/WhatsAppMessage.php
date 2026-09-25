<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class WhatsAppMessage extends Model
{
    protected $table = 'whatsapp_messages';

    /** How far along a message of ours is; a receipt never moves it back. */
    public const PROGRESS = ['sent' => 1, 'delivered' => 2, 'read' => 3];

    protected $fillable = [
        'contact_id', 'wamid', 'direction', 'type', 'body',
        'media_path', 'media_mime', 'media_name', 'media_size',
        'status', 'error', 'context_wamid', 'source', 'document_id', 'extra', 'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'extra' => 'array',
            'sent_at' => 'datetime',
            'media_size' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // The file goes with the message, as with attachments.
        static::deleted(function (WhatsAppMessage $m) {
            if ($m->media_path) {
                Storage::disk('files')->delete($m->media_path);
            }
        });
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(WhatsAppContact::class, 'contact_id');
    }
}
