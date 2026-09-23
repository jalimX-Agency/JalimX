<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskReminder extends Model
{
    /**
     * The offsets offered in the UI, label in English (the dashboard's
     * language) even though the message itself goes out in Arabic.
     */
    public const PRESETS = [
        2880 => '2 days before',
        1440 => '1 day before',
        180 => '3 hours before',
        60 => '1 hour before',
        15 => '15 minutes before',
        0 => 'At the due time',
    ];

    protected $fillable = ['task_id', 'offset_minutes', 'sent_at', 'attempts', 'last_error'];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'offset_minutes' => 'integer',
            'attempts' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
