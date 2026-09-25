<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Task extends Model
{
    /** Waiting is its own step: the ball is in someone else's court. */
    public const STATUSES = ['todo', 'doing', 'waiting', 'done'];

    public const PRIORITIES = ['low', 'normal', 'high'];

    public const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly'];

    /** A task with no time set is treated as due at this hour. */
    public const DEFAULT_DUE_TIME = '09:00:00';

    protected $fillable = [
        'engagement_id', 'client_id', 'title', 'status', 'priority', 'progress',
        'notes', 'checklist', 'due_on', 'due_time', 'repeat', 'done_at', 'position',
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

    public function reminders(): HasMany
    {
        return $this->hasMany(TaskReminder::class);
    }

    /**
     * The moment this task is actually due, for reminders: its date at
     * its time, or a fixed default hour when no time was set. Null when
     * there is no due date at all — nothing to count a reminder against.
     */
    public function dueAt(): ?Carbon
    {
        if (! $this->due_on) {
            return null;
        }

        $time = $this->due_time ? substr((string) $this->due_time, 0, 8) : self::DEFAULT_DUE_TIME;

        // 15:00 typed in the dashboard is 15:00 in Marrakech, not in UTC.
        return Carbon::parse($this->due_on->toDateString().' '.$time, config('app.business_timezone'));
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
