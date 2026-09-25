<?php

namespace App\Support;

use App\Models\Setting;

/**
 * The one thing about task reminders that is safe to edit from the
 * dashboard: which phone gets them. The credentials that talk to Meta
 * stay in the environment, not here — they are secrets, this is a
 * phone number.
 */
class WhatsAppSettings
{
    private const KEY = 'whatsapp';

    /** The number reminders go to: the one set here, or the env default. */
    public static function recipient(): ?string
    {
        $stored = Setting::map()[self::KEY]['recipient'] ?? null;

        return filled($stored) ? $stored : config('services.whatsapp.recipient');
    }

    public static function saveRecipient(?string $recipient): void
    {
        $setting = Setting::firstOrNew(['key' => self::KEY]);
        $setting->value = [...($setting->value ?? []), 'recipient' => $recipient];
        $setting->save();
    }
}
