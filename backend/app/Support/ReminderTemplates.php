<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * The WhatsApp templates a task reminder is sent with.
 *
 * Four of them, because Meta allows neither an empty variable nor a line
 * break inside one: a template with a "Notes" line always shows that
 * line. So a task with notes and a checklist gets the template that has
 * both, and a bare task gets the short one — nothing on screen is ever
 * a label with nothing after it.
 *
 * The body of each can be edited from the dashboard (Meta re-reviews it);
 * the footer and the button are fixed here.
 */
final class ReminderTemplates
{
    public const LANGUAGE = 'ar';

    /**
     * The first template, approved before these four existed. Used only as
     * a last resort while the others are still in review.
     */
    public const LEGACY = 'jalimx_task_reminder';

    public const FOOTER = 'JalimX · تذكير تلقائي';

    public const BUTTON_TEXT = 'فتح المهام';

    public const BUTTON_URL = 'https://www.jalimx.com/admin/tasks';

    private const HEAD = "⏰ *تذكير بمهمة من JalimX*\n\n📌 المهمة: *{{1}}*\n🗓️ الموعد: {{2}}\n🔗 مرتبطة بـ: {{3}}";

    private const TAIL = 'افتح لائحة المهام فالداشبورد باش تشوف التفاصيل وتعلّمها كمنجزة ملي تساليها.';

    /** @return array<string, array{name: string, label: string, hint: string, params: list<string>, body: string, example: list<string>}> */
    public static function all(): array
    {
        $example = ['تجديد استضافة الموقع', 'غدا على 15:00 — باقي نهار', 'Riad Dar Anika · Site web'];
        $notes = 'الاستضافة كتسالي نهار 30، الكود ديال الدخول عند مول الرياض';
        $steps = '1/3 منجزة: ☑ نتأكد من الثمن • ☐ نخلص • ☐ نصيفط الفاتورة للكليان';

        return [
            'basic' => [
                'name' => 'jalimx_reminder',
                'label' => 'Reminder',
                'hint' => 'For a task with no notes and no checklist.',
                'params' => ['Task', 'When', 'Linked to'],
                'body' => self::HEAD."\n\n".self::TAIL,
                'example' => $example,
            ],
            'notes' => [
                'name' => 'jalimx_reminder_notes',
                'label' => 'Reminder with notes',
                'hint' => 'For a task that has notes but no checklist.',
                'params' => ['Task', 'When', 'Linked to', 'Notes'],
                'body' => self::HEAD."\n\n📝 *ملاحظات:*\n{{4}}\n\n".self::TAIL,
                'example' => [...$example, $notes],
            ],
            'steps' => [
                'name' => 'jalimx_reminder_steps',
                'label' => 'Reminder with checklist',
                'hint' => 'For a task that has a checklist but no notes.',
                'params' => ['Task', 'When', 'Linked to', 'Checklist'],
                'body' => self::HEAD."\n\n✅ *الخطوات:*\n{{4}}\n\n".self::TAIL,
                'example' => [...$example, $steps],
            ],
            'full' => [
                'name' => 'jalimx_reminder_full',
                'label' => 'Reminder with notes and checklist',
                'hint' => 'For a task that has both.',
                'params' => ['Task', 'When', 'Linked to', 'Notes', 'Checklist'],
                'body' => self::HEAD."\n\n📝 *ملاحظات:*\n{{4}}\n\n✅ *الخطوات:*\n{{5}}\n\n".self::TAIL,
                'example' => [...$example, $notes, $steps],
            ],
        ];
    }

    /** @return array{name: string, label: string, hint: string, params: list<string>, body: string, example: list<string>} */
    public static function get(string $key): array
    {
        return self::all()[$key] ?? throw new InvalidArgumentException("Unknown reminder template [{$key}].");
    }

    /**
     * What Meta is sent to create or edit one: the body (which the
     * dashboard may change), and the footer and button (which it may not).
     *
     * @param  list<string>  $example
     * @return list<array<string, mixed>>
     */
    public static function components(string $body, array $example): array
    {
        return [
            ['type' => 'BODY', 'text' => $body, 'example' => ['body_text' => [$example]]],
            ['type' => 'FOOTER', 'text' => self::FOOTER],
            ['type' => 'BUTTONS', 'buttons' => [
                ['type' => 'URL', 'text' => self::BUTTON_TEXT, 'url' => self::BUTTON_URL],
            ]],
        ];
    }

    /**
     * Why Meta would refuse this body, checked before asking it: every
     * variable from {{1}} to {{n}} exactly once, none at the very start
     * or end, none touching another.
     */
    public static function problem(string $body, int $params): ?string
    {
        $body = trim($body);
        if ($body === '') {
            return 'The message cannot be empty.';
        }
        if (mb_strlen($body) > 1024) {
            return 'WhatsApp allows at most 1024 characters.';
        }

        preg_match_all('/\{\{\s*(\d+)\s*\}\}/', $body, $found);
        $numbers = array_map('intval', $found[1]);
        sort($numbers);
        $wanted = range(1, $params);
        if ($numbers !== $wanted) {
            $list = implode(', ', array_map(fn ($n) => '{{'.$n.'}}', $wanted));

            return "Use each of {$list} exactly once, and no others.";
        }

        if (preg_match('/^\{\{\d+\}\}|\{\{\d+\}\}$/', $body)) {
            return 'The message cannot start or end with a variable — add some words around it.';
        }
        if (preg_match('/\}\}\s*\{\{/', $body)) {
            return 'Two variables cannot sit side by side — put some words between them.';
        }

        return null;
    }
}
