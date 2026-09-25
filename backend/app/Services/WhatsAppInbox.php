<?php

namespace App\Services;

use App\Mail\WhatsAppMessageMail;
use App\Models\Client;
use App\Models\WhatsAppContact;
use App\Models\WhatsAppMessage;
use App\Support\PhoneNumber;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Everything that goes through the agency's WhatsApp number, kept.
 *
 * Messages in come from Meta's webhook; messages out are recorded by
 * whatever sent them. Delivery receipts move ours along — sent,
 * delivered, read — and never back, since Meta does not promise to post
 * them in order.
 */
final class WhatsAppInbox
{
    /** Files larger than this are noted, not kept. */
    private const MAX_MEDIA_BYTES = 25 * 1024 * 1024;

    /** One email per conversation per this many seconds, not one per message. */
    private const ALERT_EVERY = 600;

    public function __construct(private readonly WhatsAppClient $client) {}

    public static function make(): self
    {
        return new self(WhatsAppClient::fromConfig());
    }

    /**
     * One "messages" change from the webhook: new messages in, receipts
     * for ours, or both.
     *
     * @param  array<string, mixed>  $value
     */
    public function handle(array $value): void
    {
        $names = collect($value['contacts'] ?? [])
            ->mapWithKeys(fn ($c) => [(string) ($c['wa_id'] ?? '') => $c['profile']['name'] ?? null]);

        foreach ($value['messages'] ?? [] as $message) {
            $this->receive($message, $names[$message['from'] ?? ''] ?? null);
        }

        foreach ($value['statuses'] ?? [] as $status) {
            $this->receipt($status);
        }
    }

    /** @param array<string, mixed> $m */
    private function receive(array $m, ?string $profileName): void
    {
        $wamid = (string) ($m['id'] ?? '');
        // Meta retries a webhook it thinks failed; the second copy is ignored.
        if ($wamid === '' || WhatsAppMessage::where('wamid', $wamid)->exists()) {
            return;
        }

        $contact = $this->contact((string) $m['from'], $profileName);
        $at = Carbon::createFromTimestamp((int) ($m['timestamp'] ?? time()));
        $type = (string) ($m['type'] ?? 'unsupported');

        $row = [
            'contact_id' => $contact->id,
            'wamid' => $wamid,
            'direction' => 'in',
            'type' => $type,
            'status' => 'received',
            'context_wamid' => $m['context']['id'] ?? null,
            'sent_at' => $at,
        ];

        switch ($type) {
            case 'text':
                $row['body'] = $m['text']['body'] ?? '';
                break;
            case 'image':
            case 'video':
            case 'audio':
            case 'document':
            case 'sticker':
                $media = $m[$type];
                $row['body'] = $media['caption'] ?? null;
                $row['media_name'] = $media['filename'] ?? null;
                $row['media_mime'] = $media['mime_type'] ?? null;
                $row += $this->keep($media['id'] ?? null, $contact, $row['media_mime']);
                break;
            case 'location':
                $l = $m['location'];
                $row['body'] = trim(($l['name'] ?? '').' '.($l['address'] ?? '')) ?: null;
                $row['extra'] = array_intersect_key($l, array_flip(['latitude', 'longitude', 'name', 'address']));
                break;
            case 'reaction':
                $row['body'] = $m['reaction']['emoji'] ?? '';
                $row['context_wamid'] = $m['reaction']['message_id'] ?? null;
                break;
            case 'button':
                $row['body'] = $m['button']['text'] ?? '';
                break;
            case 'interactive':
                $i = $m['interactive'];
                $row['body'] = $i['button_reply']['title'] ?? $i['list_reply']['title'] ?? '';
                break;
            case 'contacts':
                $row['body'] = collect($m['contacts'] ?? [])
                    ->map(fn ($c) => trim(($c['name']['formatted_name'] ?? '').' '.($c['phones'][0]['phone'] ?? '')))
                    ->implode("\n");
                break;
            default:
                $row['type'] = 'unsupported';
                $row['body'] = null;
        }

        $message = WhatsAppMessage::create($row);

        $contact->forceFill([
            'last_message_at' => max($contact->last_message_at ?? $at, $at),
            'last_inbound_at' => max($contact->last_inbound_at ?? $at, $at),
            'unread' => $contact->unread + ($type === 'reaction' ? 0 : 1),
        ])->save();

        if ($type !== 'reaction') {
            $this->alert($contact, $message);
        }
    }

    /** @param array<string, mixed> $s */
    private function receipt(array $s): void
    {
        $message = WhatsAppMessage::where('wamid', (string) ($s['id'] ?? ''))->first();
        if (! $message) {
            return;
        }

        $status = (string) ($s['status'] ?? '');

        if ($status === 'failed') {
            $message->update([
                'status' => 'failed',
                'error' => Str::limit((string) ($s['errors'][0]['error_data']['details']
                    ?? $s['errors'][0]['title'] ?? 'Not delivered.'), 490),
            ]);

            return;
        }

        $now = WhatsAppMessage::PROGRESS[$message->status] ?? 0;
        $next = WhatsAppMessage::PROGRESS[$status] ?? 0;
        if ($next > $now) {
            $message->update(['status' => $status]);
        }
    }

    /**
     * A message we sent, written into its conversation so the thread shows
     * both sides.
     *
     * @param  array<string, mixed>  $extra  Anything else for the row: document_id, media fields.
     */
    public function recordOutgoing(string $to, string $wamid, string $type, ?string $body, string $source, array $extra = []): WhatsAppMessage
    {
        $contact = $this->contact($to, null);
        $now = now();

        $message = WhatsAppMessage::create([
            'contact_id' => $contact->id,
            'wamid' => $wamid ?: null,
            'direction' => 'out',
            'type' => $type,
            'body' => $body,
            'status' => 'sent',
            'source' => $source,
            'sent_at' => $now,
            ...$extra,
        ]);

        $contact->forceFill(['last_message_at' => $now])->save();

        return $message;
    }

    /**
     * Records an outgoing message without ever failing the send: by the
     * time this runs the message has left, and a hiccup writing it down
     * must not tell the user it did not.
     *
     * @param  array<string, mixed>  $extra
     */
    public static function recordQuietly(self $inbox, string $to, string $wamid, string $type, ?string $body, string $source, array $extra = []): void
    {
        try {
            $inbox->recordOutgoing($to, $wamid, $type, $body, $source, $extra);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** A template's body with its {{n}} filled in, as the person reads it. */
    public static function fill(string $body, array $params): string
    {
        return preg_replace_callback('/\{\{\s*(\d+)\s*\}\}/', fn ($m) => $params[(int) $m[1] - 1] ?? $m[0], $body);
    }

    /**
     * The person behind a number, created the first time they appear and
     * linked to the client with that number when there is one.
     */
    public function contact(string $waId, ?string $name): WhatsAppContact
    {
        $contact = WhatsAppContact::firstOrNew(['wa_id' => $waId]);

        if (filled($name)) {
            $contact->name = Str::limit($name, 190, '');
        }
        if (! $contact->client_id) {
            $contact->client_id = self::clientFor($waId)?->id;
        }
        $contact->save();

        return $contact;
    }

    /** The client whose phone, written any way, is this number. */
    public static function clientFor(string $waId): ?Client
    {
        return Client::query()
            ->whereNotNull('phone')
            ->get(['id', 'phone'])
            ->first(fn (Client $c) => PhoneNumber::forWhatsApp($c->phone) === $waId);
    }

    /**
     * Fetches a received file straight away — Meta's link expires within
     * minutes — and keeps it encrypted on the private disk.
     *
     * @return array<string, mixed>
     */
    private function keep(?string $mediaId, WhatsAppContact $contact, ?string $mime): array
    {
        if (! $mediaId) {
            return [];
        }

        try {
            $file = $this->client->downloadMedia($mediaId);
        } catch (Throwable $e) {
            report($e);

            return ['error' => 'The file could not be fetched from WhatsApp.'];
        }

        $size = strlen($file['bytes']);
        if ($size > self::MAX_MEDIA_BYTES) {
            return ['media_size' => $size, 'error' => 'Too large to keep here — ask them to send it another way.'];
        }

        $path = "whatsapp/{$contact->id}/".Str::uuid();
        Storage::disk('files')->put($path, Crypt::encryptString($file['bytes']));

        return ['media_path' => $path, 'media_size' => $size, 'media_mime' => $mime ?: $file['mime']];
    }

    /** An email to the agency, at most one per conversation every ten minutes. */
    private function alert(WhatsAppContact $contact, WhatsAppMessage $message): void
    {
        $to = config('services.whatsapp.notify');
        if (! $to || ! Cache::add("whatsapp.alert.{$contact->id}", true, self::ALERT_EVERY)) {
            return;
        }

        try {
            Mail::to($to)->send(new WhatsAppMessageMail($contact->loadMissing('client'), $message));
        } catch (Throwable $e) {
            // An alert that did not go is not a message that was lost: it is
            // still in the inbox. Logged, never thrown back at Meta.
            report($e);
        }
    }
}
