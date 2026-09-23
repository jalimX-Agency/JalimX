<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * A thin wrapper on Meta's WhatsApp Cloud API, for one purpose: telling
 * Mohamed a task is due. Not a client channel — the recipient is always
 * the agency's own number from config.
 *
 * Meta refuses a business-initiated message unless it uses a template
 * that was submitted and approved beforehand; sendTemplate is built
 * around that from the start rather than a free-text send that would
 * only work inside a 24-hour customer-service window.
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
        return (bool) ($this->token && $this->phoneNumberId);
    }

    /**
     * A read-only call: confirms the token and phone number id are valid
     * and returns the number's display name, without sending anything or
     * needing a template.
     *
     * @return array<string, mixed>
     */
    public function checkConnection(): array
    {
        $response = $this->request()->get(self::BASE."/{$this->phoneNumberId}", [
            'fields' => 'verified_name,display_phone_number,quality_rating',
        ]);

        if ($response->failed()) {
            throw new RuntimeException($this->explain($response));
        }

        return $response->json();
    }

    /** @return array<string, mixed> */
    public function listTemplates(): array
    {
        $response = $this->request()->get(self::BASE."/{$this->businessAccountId}/message_templates", [
            'fields' => 'name,status,language,category',
            'limit' => 100,
        ]);

        if ($response->failed()) {
            throw new RuntimeException($this->explain($response));
        }

        return $response->json('data', []);
    }

    /**
     * Submits a template for Meta's approval. Only needs doing once; it
     * then takes minutes to hours to be approved, and every send after
     * that reuses it by name.
     *
     * @param  list<string>  $bodyParams  Example values shown to the reviewer.
     */
    public function createTemplate(string $name, string $language, string $body, array $bodyParams): array
    {
        $response = $this->request()->post(self::BASE."/{$this->businessAccountId}/message_templates", [
            'name' => $name,
            'language' => $language,
            'category' => 'UTILITY',
            'components' => [
                [
                    'type' => 'BODY',
                    'text' => $body,
                    'example' => ['body_text' => [$bodyParams]],
                ],
            ],
        ]);

        if ($response->failed()) {
            throw new RuntimeException($this->explain($response));
        }

        return $response->json();
    }

    /**
     * Sends an approved template to the agency's own number. $params fill
     * the template's {{1}}, {{2}}... in order.
     *
     * @param  list<string>  $params
     * @return string The message id, for the sent log.
     */
    public function sendTemplate(string $templateName, string $language, array $params): string
    {
        $to = config('services.whatsapp.recipient');
        if (! $to) {
            throw new RuntimeException('No WhatsApp recipient is configured.');
        }

        $response = $this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $language],
                'components' => $params
                    ? [['type' => 'body', 'parameters' => array_map(fn ($p) => ['type' => 'text', 'text' => $p], $params)]]
                    : [],
            ],
        ]);

        if ($response->failed()) {
            throw new RuntimeException($this->explain($response));
        }

        return (string) $response->json('messages.0.id', '');
    }

    private function request()
    {
        return Http::withToken($this->token)->acceptJson();
    }

    /** Meta's error body is where the actual reason lives. */
    private function explain($response): string
    {
        $message = $response->json('error.message') ?? $response->body();

        return "WhatsApp API error ({$response->status()}): {$message}";
    }
}
