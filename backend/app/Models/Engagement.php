<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Engagement extends Model
{
    public const STATUSES = ['planned', 'active', 'paused', 'done', 'cancelled'];

    /** one_off: a job with an end. monthly: a retainer that runs on. */
    public const BILLINGS = ['one_off', 'monthly'];

    protected $fillable = [
        'client_id', 'title', 'status', 'billing', 'budget',
        'starts_on', 'ends_on', 'description', 'case_study_id',
    ];

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
