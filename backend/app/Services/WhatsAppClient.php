<?php

namespace App\Services;

use App\Support\WhatsAppSettings;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * A thin wrapper on Meta's WhatsApp Cloud API.
 *
 * Meta refuses a business-initiated message unless it uses a template
 * that was submitted and approved beforehand; sendTemplate is built
 * around that from the start rather than a free-text send that would
 * only work inside a 24-hour customer-service window.
 *
 * Built with fromConfig(), never by the container: its constructor
 * arguments are optional, so the container would happily make an empty
 * one that thinks it is not configured.
 */
class WhatsAppClient
{
    private const BASE = 'https://graph.facebook.com/v21.0';

    public function __construct(
        private readonly ?string $token = null,
        private readonly ?string $phoneNumberId = null,
        private readonly ?string $businessAccountId = null,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            config('services.whatsapp.token'),
            config('services.whatsapp.phone_number_id'),
            config('services.whatsapp.business_account_id'),
        );
    }

    public function configured(): bool
    {
        return (bool) ($this->token && $this->phoneNumberId && $this->businessAccountId);
    }

    /**
     * A read-only call: confirms the token and phone number id are valid
     * and returns the number's display name, without sending anything.
     *
     * @return array<string, mixed>
     */
    public function checkConnection(): array
    {
        $response = $this->request()->get(self::BASE."/{$this->phoneNumberId}", [
            'fields' => 'verified_name,display_phone_number,quality_rating',
        ]);

        return $this->ok($response)->json();
    }

    /**
     * Every template on the account, by name, with the body text so the
     * dashboard can show and edit what is actually live.
     *
     * @return array<string, array{id: string, status: string, language: string, body: string, rejected_reason: ?string}>
     */
    public function templates(): array
    {
        $response = $this->request()->get(self::BASE."/{$this->businessAccountId}/message_templates", [
            'fields' => 'id,name,status,language,components,rejected_reason',
            'limit' => 200,
        ]);

        $out = [];
        foreach ($this->ok($response)->json('data', []) as $t) {
            $body = collect($t['components'] ?? [])->firstWhere('type', 'BODY')['text'] ?? '';
            $reason = $t['rejected_reason'] ?? null;
            $out[$t['name']] = [
                'id' => (string) $t['id'],
                'status' => (string) $t['status'],
                'language' => (string) ($t['language'] ?? ''),
                'body' => (string) $body,
                // Meta says "NONE" when there is no reason.
                'rejected_reason' => $reason && $reason !== 'NONE' ? (string) $reason : null,
            ];
        }

        return $out;
    }

    /**
     * Submits a new template for Meta's approval.
     *
     * @param  list<array<string, mixed>>  $components
     * @return array<string, mixed>
     */
    public function createTemplate(string $name, string $language, array $components): array
    {
        $response = $this->request()->post(self::BASE."/{$this->businessAccountId}/message_templates", [
            'name' => $name,
            'language' => $language,
            'category' => 'UTILITY',
            'components' => $components,
        ]);

        return $this->ok($response)->json();
    }

    /**
     * Changes an existing template. It goes back to review, and Meta
     * limits how often an approved one can be edited.
     *
     * @param  list<array<string, mixed>>  $components
     */
    public function editTemplate(string $id, array $components): void
    {
        $this->ok($this->request()->post(self::BASE."/{$id}", ['components' => $components]));
    }

    /**
     * Sends an approved template. $params fill {{1}}, {{2}}... in order.
     * The recipient is the agency's own number unless one is given.
     *
     * @param  list<string>  $params
     * @return string The message id.
     */
    public function sendTemplate(string $templateName, string $language, array $params, ?string $to = null): string
    {
        $to ??= WhatsAppSettings::recipient();
        if (! $to) {
            throw new RuntimeException('No WhatsApp number is set to receive reminders.');
        }

        $response = $this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $language],
                'components' => $params
                    ? [['type' => 'body', 'parameters' => array_map(
                        fn ($p) => ['type' => 'text', 'text' => self::clean($p)],
                        $params,
                    )]]
                    : [],
            ],
        ]);

        return (string) $this->ok($response)->json('messages.0.id', '');
    }

    /**
     * Meta rejects a variable with a line break, a tab, more than four
     * spaces in a row, or nothing at all.
     */
    public static function clean(string $text): string
    {
        $text = preg_replace('/[\r\n\t]+/u', ' · ', $text);
        $text = trim(preg_replace('/ {2,}/', ' ', $text));

        return $text === '' ? '—' : $text;
    }

    private function request()
    {
        return Http::withToken($this->token)->acceptJson()->timeout(20);
    }

    private function ok($response)
    {
        if ($response->failed()) {
            // Meta's error body is where the actual reason lives; the
            // user-facing message is the readable one when there is one.
            $message = $response->json('error.error_user_msg')
                ?? $response->json('error.message')
                ?? $response->body();

            throw new RuntimeException("WhatsApp: {$message}");
        }

        return $response;
    }
}
