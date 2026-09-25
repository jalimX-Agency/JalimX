<?php

namespace App\Services;

use App\Support\ReminderTemplates;
use App\Support\WhatsAppSettings;
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
    /** @var array<string, array<string, mixed>>|null name => template, read once per run */
    private ?array $templates = null;

    public function __construct(private readonly WhatsAppClient $client) {}

    /**
     * @param  list<string>  $params
     * @return string The name of the template that was used.
     */
    public function send(string $key, array $params, string $source = 'reminder'): string
    {
        $candidates = [
            [ReminderTemplates::get($key)['name'], $params],
            [ReminderTemplates::get('basic')['name'], array_slice($params, 0, 3)],
            [ReminderTemplates::LEGACY, array_slice($params, 0, 3)],
        ];

        foreach ($candidates as [$name, $values]) {
            if ($this->approved($name)) {
                $to = WhatsAppSettings::recipient();
                $wamid = $this->client->sendTemplate($name, ReminderTemplates::LANGUAGE, $values, $to);
                WhatsAppInbox::recordQuietly(new WhatsAppInbox($this->client), (string) $to, $wamid, 'template',
                    WhatsAppInbox::fill($this->templates[$name]['body'] ?? '', $values), $source);

                return $name;
            }
        }

        throw new RuntimeException('No reminder template is approved by Meta yet.');
    }

    private function approved(string $name): bool
    {
        $this->templates ??= $this->client->templates();

        return ($this->templates[$name]['status'] ?? null) === 'APPROVED';
    }
}
