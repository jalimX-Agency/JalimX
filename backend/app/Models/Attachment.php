<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Attachment extends Model
{
    /** Enough to sort a folder by eye; "other" carries the rest. */
    public const KINDS = ['contract', 'quote', 'brief', 'image', 'invoice', 'other'];

    protected $fillable = ['kind', 'name', 'path', 'disk', 'mime', 'size'];

    protected function casts(): array
    {
        return ['size' => 'integer'];
    }

    public function engagement(): BelongsTo
    {
        return $this->belongsTo(Engagement::class);
    }

    /** Deleting the row takes the file with it; an orphan in a bucket is a bill. */
    protected static function booted(): void
    {
        static::deleted(function (Attachment $attachment) {
            Storage::disk($attachment->disk)->delete($attachment->path);
        });
    }
}
