<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Engagement extends Model
{
    public const STATUSES = ['planned', 'active', 'paused', 'done', 'cancelled'];

    /** one_off: a job with an end. monthly: a retainer that runs on. */
    public const BILLINGS = ['one_off', 'monthly'];

    /** A retainer's month is paid once it is over (end), or in advance (start). */
    public const PAYMENT_TIMINGS = ['end', 'start'];

    protected $fillable = [
        'client_id', 'title', 'status', 'billing', 'payment_timing', 'budget',
        'starts_on', 'ends_on', 'description', 'case_study_id',
    ];

    /**
     * The month of a retainer that a month's invoice is for, and when it
     * is due.
     *
     * Months run from the day the work started: begun on 27 June, the
     * October invoice covers 27 September to 26 October. Paid at the end
     * (the default) it is due on 27 October; paid at the start, on
     * 27 September. A start on the 31st falls on the last day of shorter
     * months. Without a start date, months are calendar months.
     *
     * @return array{start: Carbon, end: Carbon, due: Carbon}
     */
    public function billingCycle(Carbon $month): array
    {
        $month = $month->copy()->startOfMonth();
        $day = $this->starts_on?->day;

        if ($day === null) {
            $start = $month->copy();
            $end = $month->copy()->endOfMonth()->startOfDay();
            $due = $this->payment_timing === 'start' ? $start->copy() : $end->copy();

            return ['start' => $start, 'end' => $end, 'due' => $due];
        }

        $on = fn (Carbon $m) => $m->copy()->day(min($day, $m->daysInMonth));
        $closes = $on($month);
        $start = $on($month->copy()->subMonthNoOverflow());

        return [
            'start' => $start,
            'end' => $closes->copy()->subDay(),
            'due' => $this->payment_timing === 'start' ? $start->copy() : $closes,
        ];
    }

    protected function casts(): array
    {
        return [
            'budget' => 'decimal:2',
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /** What the work consists of: a site, social media, SEO, platforms. */
    public function workTypes(): BelongsToMany
    {
        return $this->belongsToMany(WorkType::class)->orderBy('position');
    }

    /**
     * What is left to do, then what was done: open tasks by date (undated
     * last), finished ones most recent first.
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class)
            ->orderByRaw('done_at is not null')
            ->orderByRaw('due_on is null')
            ->orderBy('due_on')
            ->orderBy('position')
            ->orderByDesc('done_at')
            ->orderBy('id');
    }

    /** Contracts, briefs and whatever else was signed or sent. */
    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class)->latest('id');
    }

    /** The logins that belong to this piece of work. */
    public function credentials(): HasMany
    {
        return $this->hasMany(Credential::class);
    }

    /** What has been quoted and billed for this work. */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /** The public case study written about this work, if there is one. */
    public function caseStudy(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'case_study_id');
    }
}
