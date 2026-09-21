<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class WorkType extends Model
{
    protected $fillable = ['name', 'slug', 'position', 'needs_logins', 'is_active'];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'needs_logins' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function engagements(): BelongsToMany
    {
        return $this->belongsToMany(Engagement::class);
    }
}
