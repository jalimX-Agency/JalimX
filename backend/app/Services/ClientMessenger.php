<?php

namespace App\Services;

use App\Support\ClientTemplates;
use App\Support\PhoneNumber;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Sends a client a PDF on WhatsApp, under one of the client templates.
 *
 * Checks what can be checked before anything leaves — the number, the
 * template's approval — so a refusal says what to fix instead of being a
 * Meta error code.
 */
final class ClientMessenger
{
    public function __construct(private readonly WhatsAppClient $client) {}

    public static function make(): self
    {
        $client = WhatsAppClient::fromConfig();
        if (! $client->configured()) {
            throw new RuntimeException('WhatsApp is not connected on the server.');
        }

        return new self($client);
    }

    /** The number to send to, or a validation error saying why there is none. */
    public static function number(?string $typed, ?string $onFile): string
    {
        $source = filled($typed) ? $typed : $onFile;
        if (! filled($source)) {
            throw ValidationException::withMessages([
                'to' => 'This client has no phone number. Add one on the Details tab, or type it here.',
            ]);
        }

        return PhoneNumber::forWhatsApp($source) ?? throw ValidationException::withMessages([
            'to' => "“{$source}” is not a number WhatsApp can use. Write it with its country code, e.g. 212612345678.",
        ]);
    }

    /**
     * @param  list<string>  $params
     * @param  array<string, mixed>  $record  Extra fields for the inbox row, e.g. document_id.
     * @return string The message id.
     */
    public function send(string $key, string $to, array $params, string $pdf, string $filename, array $record = []): string
    {
        $def = ClientTemplates::get($key);
        $live = $this->client->templates()[$def['name']] ?? null;
        $status = $live['status'] ?? null;

        if ($status !== 'APPROVED') {
            throw new RuntimeException(match ($status) {
                null => "The “{$def['label']}” WhatsApp message has not been created yet. Create it in Settings → WhatsApp.",
                'PENDING', 'IN_APPEAL' => "The “{$def['label']}” WhatsApp message is still being reviewed by Meta. Try again once it is approved.",
                default => "Meta has not approved the “{$def['label']}” WhatsApp message (".strtolower($status).'). See Settings → WhatsApp.',
            });
        }

        $media = $this->client->uploadMedia($pdf, $filename);

        $wamid = $this->client->sendTemplate(
            $def['name'],
            ClientTemplates::LANGUAGE,
            $params,
            $to,
            ['id' => $media, 'filename' => $filename],
        );

        // Into the conversation, so the thread shows it and its receipts.
        // The PDF itself is not kept: the invoice can be reopened, and a
        // logins sheet should not sit in one more place.
        WhatsAppInbox::recordQuietly(new WhatsAppInbox($this->client), $to, $wamid, 'template',
            WhatsAppInbox::fill($live['body'] ?? $def['body'], $params), $key,
            ['media_name' => $filename, 'media_mime' => 'application/pdf', ...$record]);

        return $wamid;
    }
}
