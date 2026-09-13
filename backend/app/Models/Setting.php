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
