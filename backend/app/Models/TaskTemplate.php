<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskTemplate extends Model
{
    protected $fillable = ['name', 'description', 'work_type_id', 'items', 'position'];

    protected function casts(): array
    {
        return [
            'items' => 'array',
            'position' => 'integer',
        ];
    }

    public function workType(): BelongsTo
    {
        return $this->belongsTo(WorkType::class);
    }
}
