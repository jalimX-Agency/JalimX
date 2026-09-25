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
     * The recipient is the agency's own number unless one is given. A
     * template with a document header is sent with the id of a file put
     * there by uploadMedia().
     *
     * @param  list<string>  $params
     * @param  array{id: string, filename: string}|null  $document
     * @return string The message id.
     */
    public function sendTemplate(
        string $templateName,
        string $language,
        array $params,
        ?string $to = null,
        ?array $document = null,
    ): string {
        $to ??= WhatsAppSettings::recipient();
        if (! $to) {
            throw new RuntimeException('No WhatsApp number is set to receive reminders.');
        }

        $components = [];
        if ($document) {
            $components[] = ['type' => 'header', 'parameters' => [
                ['type' => 'document', 'document' => $document],
            ]];
        }
        if ($params) {
            $components[] = ['type' => 'body', 'parameters' => array_map(
                fn ($p) => ['type' => 'text', 'text' => self::clean($p)],
                $params,
            )];
        }

        $response = $this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => ['code' => $language],
                'components' => $components,
            ],
        ]);

        return (string) $this->ok($response)->json('messages.0.id', '');
    }

    /**
     * Puts a file on Meta's side for sending. The id it returns is good
     * for a message sent soon after; it is not kept here.
     */
    public function uploadMedia(string $bytes, string $filename, string $mime = 'application/pdf'): string
    {
        $response = Http::withToken($this->token)->acceptJson()->timeout(60)
            ->attach('file', $bytes, $filename, ['Content-Type' => $mime])
            ->post(self::BASE."/{$this->phoneNumberId}/media", [
                'messaging_product' => 'whatsapp',
                'type' => $mime,
            ]);

        return (string) $this->ok($response)->json('id');
    }

    /**
     * A sample file for a template that carries one. Meta's reviewers want
     * to see an example document, and it has to go through the app's
     * resumable upload rather than the ordinary media endpoint.
     */
    public function uploadExample(string $bytes, string $filename, string $mime = 'application/pdf'): string
    {
        $appId = $this->ok($this->request()->get(self::BASE.'/app'))->json('id');

        $session = $this->ok($this->request()->post(self::BASE."/{$appId}/uploads?".http_build_query([
            'file_name' => $filename,
            'file_length' => strlen($bytes),
            'file_type' => $mime,
        ])))->json('id');

        $response = Http::withHeaders([
            // This endpoint wants "OAuth", not "Bearer".
            'Authorization' => 'OAuth '.$this->token,
            'file_offset' => '0',
        ])->timeout(60)->withBody($bytes, $mime)->post(self::BASE."/{$session}");

        return (string) $this->ok($response)->json('h');
    }

    /**
     * A free-form text. Only accepted within 24 hours of the person's last
     * message to us; outside that, Meta wants a template.
     */
    public function sendText(string $to, string $body): string
    {
        $response = $this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => 'text',
            'text' => ['body' => $body, 'preview_url' => true],
        ]);

        return (string) $this->ok($response)->json('messages.0.id', '');
    }

    /**
     * A file as a free-form message: an image shows as an image, anything
     * else as a document with its name. Same 24-hour rule as text.
     */
    public function sendMedia(string $to, string $mediaId, string $mime, string $filename, ?string $caption = null): string
    {
        $type = str_starts_with($mime, 'image/') ? 'image' : 'document';
        $payload = ['id' => $mediaId];
        if ($type === 'document') {
            $payload['filename'] = $filename;
        }
        if (filled($caption)) {
            $payload['caption'] = $caption;
        }

        $response = $this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'to' => $to,
            'type' => $type,
            $type => $payload,
        ]);

        return (string) $this->ok($response)->json('messages.0.id', '');
    }

    /**
     * A file someone sent us. Meta hands out a link that expires within
     * minutes and wants the token to fetch it, so it is fetched at once.
     *
     * @return array{bytes: string, mime: string}
     */
    public function downloadMedia(string $mediaId): array
    {
        $info = $this->ok($this->request()->get(self::BASE."/{$mediaId}"))->json();

        $file = Http::withToken($this->token)->timeout(60)->get($info['url']);
        if ($file->failed()) {
            throw new RuntimeException("WhatsApp: the file could not be fetched ({$file->status()}).");
        }

        return ['bytes' => $file->body(), 'mime' => (string) ($info['mime_type'] ?? 'application/octet-stream')];
    }

    /** Blue ticks: this message, and everything before it in the chat, was read. */
    public function markRead(string $wamid): void
    {
        $this->ok($this->request()->post(self::BASE."/{$this->phoneNumberId}/messages", [
            'messaging_product' => 'whatsapp',
            'status' => 'read',
            'message_id' => $wamid,
        ]));
    }

    /**
     * Points Meta's webhooks for this account at our URL: the app is
     * subscribed to the business account, and told where to post and
     * which token proves the URL is ours.
     */
    public function connectWebhook(string $callbackUrl, string $verifyToken, string $appSecret): void
    {
        $this->ok($this->request()->post(self::BASE."/{$this->businessAccountId}/subscribed_apps"));

        $appId = $this->ok($this->request()->get(self::BASE.'/app'))->json('id');

        // Configuring the app itself takes the app's own token, id|secret.
        $this->ok(Http::acceptJson()->timeout(30)->post(self::BASE."/{$appId}/subscriptions", [
            'object' => 'whatsapp_business_account',
            'callback_url' => $callbackUrl,
            'verify_token' => $verifyToken,
            'fields' => 'messages',
            'access_token' => "{$appId}|{$appSecret}",
        ]));
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
