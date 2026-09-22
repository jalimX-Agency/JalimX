<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class Task extends Model
{
    /** Waiting is its own step: the ball is in someone else's court. */
    public const STATUSES = ['todo', 'doing', 'waiting', 'done'];

    public const PRIORITIES = ['low', 'normal', 'high'];

    public const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly'];

    protected $fillable = [
        'engagement_id', 'client_id', 'title', 'status', 'priority', 'progress',
        'notes', 'checklist', 'due_on', 'repeat', 'done_at', 'position',
    ];

    protected function casts(): array
    {
        return [
            'due_on' => 'date',
            'done_at' => 'datetime',
            'position' => 'integer',
            'progress' => 'integer',
            'checklist' => 'array',
        ];
    }

    public function engagement(): BelongsTo
    {
        return $this->belongsTo(Engagement::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * The next date a repeating task falls on: the first step after its
     * own date that is still ahead of today. A daily chore done three days
     * late comes back tomorrow, not three times at once.
     */
    public function nextDue(Carbon $today): ?Carbon
    {
        if (! $this->repeat) {
            return null;
        }

        $date = ($this->due_on ?? $today)->copy()->startOfDay();

        do {
            $date = match ($this->repeat) {
                'daily' => $date->addDay(),
                'weekdays' => $date->addWeekday(),
                'weekly' => $date->addWeek(),
                'monthly' => $date->addMonthNoOverflow(),
            };
        } while ($date->lte($today));

        return $date;
    }
}
