<?php

namespace App\Services;

use App\Support\ReminderTemplates;
use RuntimeException;

/**
 * Sends a reminder with the best template that is actually approved.
 *
 * Editing a template on the dashboard puts it back in Meta's review, and
 * a new one waits there before it can be used at all. Reminders should
 * not stop meanwhile, so a message falls back — to the short template,
 * then to the very first one — losing its notes and checklist lines for
 * a while rather than not arriving.
 */
final class ReminderSender
{
    /** @var array<string, string>|null name => status, read once per run */
    private ?array $statuses = null;

    public function __construct(private readonly WhatsAppClient $client) {}

    /**
     * @param  list<string>  $params
     * @return string The name of the template that was used.
     */
    public function send(string $key, array $params): string
    {
        $candidates = [
            [ReminderTemplates::get($key)['name'], $params],
            [ReminderTemplates::get('basic')['name'], array_slice($params, 0, 3)],
            [ReminderTemplates::LEGACY, array_slice($params, 0, 3)],
        ];

        foreach ($candidates as [$name, $values]) {
            if ($this->approved($name)) {
                $this->client->sendTemplate($name, ReminderTemplates::LANGUAGE, $values);

                return $name;
            }
        }

        throw new RuntimeException('No reminder template is approved by Meta yet.');
    }

    private function approved(string $name): bool
    {
        $this->statuses ??= array_map(fn ($t) => $t['status'], $this->client->templates());

        return ($this->statuses[$name] ?? null) === 'APPROVED';
    }
}
