<?php

namespace App\Support;

use App\Models\Task;
use Illuminate\Support\Carbon;

/**
 * What a task reminder says, line by line, and which of the four
 * templates it needs.
 *
 * Every value is one line — WhatsApp will not put a line break inside a
 * variable — so a checklist reads "☑ first • ☐ second" and notes written
 * over several lines are joined with " / ".
 */
final class TaskReminderMessage
{
    /** @return array{key: string, params: list<string>} */
    public static function for(Task $task, ?Carbon $now = null): array
    {
        $params = [self::title($task), self::when($task->dueAt(), $now), self::link($task)];
        $notes = self::notes($task);
        $steps = self::steps($task);

        if ($notes !== null) {
            $params[] = $notes;
        }
        if ($steps !== null) {
            $params[] = $steps;
        }

        $key = match (true) {
            $notes !== null && $steps !== null => 'full',
            $notes !== null => 'notes',
            $steps !== null => 'steps',
            default => 'basic',
        };

        return ['key' => $key, 'params' => $params];
    }

    private static function title(Task $task): string
    {
        // The title sits between *…* in the template; a star inside it would
        // end the bold early.
        return self::cut(str_replace(['*', '_', '~'], '', $task->title), 100);
    }

    /** "غدا على 15:00 — باقي 3 سوايع", said in Marrakech time. */
    public static function when(Carbon $dueAt, ?Carbon $now = null): string
    {
        $tz = config('app.business_timezone');
        $due = $dueAt->copy()->setTimezone($tz);
        $now = ($now ?? Carbon::now())->copy()->setTimezone($tz);

        $days = (int) $now->copy()->startOfDay()->diffInDays($due->copy()->startOfDay(), false);
        $day = match ($days) {
            0 => 'اليوم',
            1 => 'غدا',
            -1 => 'البارح',
            default => $due->format('d/m/Y'),
        };

        // From the actual moment, not the offset: a cron that ran a few
        // minutes late still says how long is really left.
        $minutes = (int) round($now->diffInMinutes($due, false));
        $left = match (true) {
            $minutes <= 0 => 'حان الوقت دابا',
            $minutes < 60 => "باقي {$minutes} دقيقة",
            $minutes < 24 * 60 => 'باقي '.self::hours((int) round($minutes / 60)),
            default => 'باقي '.self::days((int) round($minutes / 1440)),
        };

        return "{$day} على {$due->format('H:i')} — {$left}";
    }

    private static function link(Task $task): string
    {
        $client = $task->client?->name;
        $work = $task->engagement?->title;

        return implode(' · ', array_filter([$client, $work])) ?: 'مهمة شخصية';
    }

    private static function notes(Task $task): ?string
    {
        $notes = trim((string) $task->notes);
        if ($notes === '') {
            return null;
        }

        return self::cut(preg_replace('/\s*[\r\n]+\s*/u', ' / ', $notes), 300);
    }

    /** "1/3 منجزة: ☑ first • ☐ second • ☐ third", within a length WhatsApp keeps. */
    private static function steps(Task $task): ?string
    {
        $items = collect($task->checklist ?? [])->filter(fn ($i) => trim((string) ($i['text'] ?? '')) !== '');
        if ($items->isEmpty()) {
            return null;
        }

        $done = $items->where('done', true)->count();
        $head = "{$done}/{$items->count()} منجزة:";

        $parts = [];
        $length = mb_strlen($head);
        foreach ($items->values() as $i => $item) {
            $part = ($item['done'] ? '☑ ' : '☐ ').self::cut(trim($item['text']), 80);
            if ($length + mb_strlen($part) + 3 > 450) {
                $parts[] = '… +'.($items->count() - $i);
                break;
            }
            $parts[] = $part;
            $length += mb_strlen($part) + 3;
        }

        return $head.' '.implode(' • ', $parts);
    }

    private static function hours(int $h): string
    {
        return match ($h) {
            1 => 'ساعة',
            2 => 'ساعتين',
            default => "{$h} سوايع",
        };
    }

    private static function days(int $d): string
    {
        return match ($d) {
            1 => 'نهار',
            2 => 'يوماين',
            default => "{$d} أيام",
        };
    }

    private static function cut(string $text, int $max): string
    {
        $text = trim($text);

        return mb_strlen($text) > $max ? rtrim(mb_substr($text, 0, $max - 1)).'…' : $text;
    }
}
