<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Engagement extends Model
{
    public const STATUSES = ['planned', 'active', 'paused', 'done', 'cancelled'];

    protected $fillable = [
        'client_id', 'title', 'status', 'budget',
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
