<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Lead extends Model
{
    public const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

    protected $fillable = [
        'name', 'email', 'phone', 'company',
        'budget_range', 'service_interest', 'message',
        'status', 'locale', 'source', 'ip',
        'note',
    ];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    /**
     * Never serialised to the public API - a lead is written by anyone and read
     * only by the team.
     */
    protected $hidden = ['ip'];
}
