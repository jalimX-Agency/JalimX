<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One login. The secret and the notes never touch the database in the
 * clear — `encrypted` casts them on the way in and out, which means they
 * are also unreadable to anything that loses the application key's company.
 */
class Credential extends Model
{
    protected $fillable = [
        'client_id', 'engagement_id', 'label', 'url', 'username', 'secret', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'secret' => 'encrypted',
            'notes' => 'encrypted',
        ];
    }

    /** Never serialised by accident: the secret leaves only when asked for. */
    protected $hidden = ['secret', 'notes'];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function engagement(): BelongsTo
    {
        return $this->belongsTo(Engagement::class);
    }
}
