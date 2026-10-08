<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class Setting extends Model
{
    protected $primaryKey = 'key';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['key', 'value'];

    protected function casts(): array
    {
        return ['value' => 'array'];
    }

    /**
     * The settings the public site is allowed to read.
     *
     * The table also holds what the dashboard keeps for itself — the number
     * task reminders go to, the billing profile with its bank details — and
     * the public endpoint used to return the whole table. A key is public only
     * if it is listed here, so a new private setting stays private by default.
     */
    public const PUBLIC_KEYS = [
        'tagline',
        'hero_headline',
        'hero_body',
        'contact_email',
        'contact_phone',
        'contact_whatsapp',
        'contact_location',
        'social',
        'locales',
    ];

    /** @return array<string, mixed> */
    public static function publicMap(): array
    {
        return array_intersect_key(static::map(), array_flip(self::PUBLIC_KEYS));
    }

    /** All settings as a flat key => value map, cached until something writes. */
    public static function map(): array
    {
        return Cache::rememberForever('settings.map', fn () => static::query()
            ->pluck('value', 'key')
            ->all());
    }

    protected static function booted(): void
    {
        $forget = fn () => Cache::forget('settings.map');

        static::saved($forget);
        static::deleted($forget);
    }
}
