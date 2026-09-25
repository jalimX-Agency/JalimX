<?php

namespace App\Support;

use App\Models\WhatsAppContact;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * "Has anything happened in the inbox?", answered without the database.
 *
 * Every page of the dashboard asks every few seconds — that is what
 * makes a new message show up while you sit on Today — so the answer is
 * a small record in the cache, rewritten only when something actually
 * changes: a message or receipt from Meta, a conversation read, a reply
 * sent. The pages fetch real data only when its version moves.
 *
 * The cache is the API container's own; with one replica, the webhook
 * and the dashboard are the same process group and see the same record.
 */
final class InboxPulse
{
    private const KEY = 'inbox.pulse';

    /** @return array{version: string, unread: int} */
    public static function current(): array
    {
        return Cache::rememberForever(self::KEY, fn () => self::fresh());
    }

    /** Something changed: a new version, and the unread count re-counted. */
    public static function bump(): void
    {
        Cache::forever(self::KEY, self::fresh());
    }

    /** @return array{version: string, unread: int} */
    private static function fresh(): array
    {
        return ['version' => (string) Str::ulid(), 'unread' => (int) WhatsAppContact::sum('unread')];
    }
}
