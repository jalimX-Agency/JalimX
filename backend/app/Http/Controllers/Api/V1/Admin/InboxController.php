<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\WhatsAppContact;
use App\Models\WhatsAppMessage;
use App\Services\WhatsAppClient;
use App\Services\WhatsAppInbox;
use App\Support\WhatsAppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The inbox: every conversation on the agency's WhatsApp number, read
 * and answered from the dashboard.
 */
class InboxController extends Controller
{
    /** Files a reply may carry: what a client can open, nothing that runs. */
    private const REPLY_MIMES = 'pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx,zip';

    public function index(): JsonResponse
    {
        $contacts = WhatsAppContact::query()
            ->whereNotNull('last_message_at')
            ->with('client:id,name', 'latestMessage')
            ->orderByDesc('last_message_at')
            ->limit(300)
            ->get();

        return response()->json([
            'data' => $contacts->map(fn (WhatsAppContact $c) => $this->contact($c))->values(),
            'unread' => (int) WhatsAppContact::sum('unread'),
        ]);
    }

    /** Just the number, for the badge in the menu. */
    public function unread(): JsonResponse
    {
        return response()->json(['data' => ['unread' => (int) WhatsAppContact::sum('unread')]]);
    }

    /**
     * One conversation. With ?after=, only what is newer than that message
     * — the page asks every few seconds and should not get the whole
     * thread each time. Opening it marks it read, here and on their phone.
     */
    public function show(Request $request, WhatsAppContact $contact): JsonResponse
    {
        $after = (int) $request->query('after', 0);

        $messages = $contact->messages()
            ->when($after, fn ($q) => $q->where('id', '>', $after))
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->limit($after ? 100 : 300)
            ->get()
            ->reverse()
            ->values();

        if ($contact->unread > 0) {
            $contact->forceFill(['unread' => 0])->save();
            $this->blueTicks($contact);
        }

        return response()->json([
            'data' => [
                'contact' => $this->contact($contact->load('client:id,name', 'latestMessage')),
                'messages' => $messages->map(fn (WhatsAppMessage $m) => $this->message($m)),
            ],
        ]);
    }

    /** A free reply: text, a file, or both — only inside the 24-hour window. */
    public function reply(Request $request, WhatsAppContact $contact): JsonResponse
    {
        $data = $request->validate([
            'text' => ['nullable', 'string', 'max:4096'],
            'file' => ['nullable', 'file', 'max:16384', 'mimes:'.self::REPLY_MIMES],
        ]);

        $text = trim((string) ($data['text'] ?? ''));
        $file = $request->file('file');

        if ($text === '' && ! $file) {
            throw ValidationException::withMessages(['text' => 'Write something, or add a file.']);
        }
        if (! $contact->canReply()) {
            throw ValidationException::withMessages([
                'text' => 'Their last message was more than 24 hours ago. WhatsApp only allows an approved template until they write again.',
            ]);
        }

        $client = WhatsAppClient::fromConfig();
        abort_unless($client->configured(), 409, 'WhatsApp is not connected on the server.');
        $inbox = new WhatsAppInbox($client);
        $sent = [];

        try {
            if ($file) {
                $bytes = $file->get();
                $name = $file->getClientOriginalName();
                $mime = (string) $file->getMimeType();
                $mediaId = $client->uploadMedia($bytes, $name, $mime);
                // A file with a short text: the text rides as its caption.
                $caption = $text !== '' && mb_strlen($text) <= 1000 ? $text : null;
                $wamid = $client->sendMedia($contact->wa_id, $mediaId, $mime, $name, $caption);

                $path = "whatsapp/{$contact->id}/".Str::uuid();
                Storage::disk('files')->put($path, Crypt::encryptString($bytes));

                $sent[] = $inbox->recordOutgoing($contact->wa_id, $wamid, str_starts_with($mime, 'image/') ? 'image' : 'document', $caption, 'reply', [
                    'media_path' => $path, 'media_mime' => $mime, 'media_name' => $name, 'media_size' => strlen($bytes),
                ]);
                if ($caption !== null) {
                    $text = '';
                }
            }

            if ($text !== '') {
                $wamid = $client->sendText($contact->wa_id, $text);
                $sent[] = $inbox->recordOutgoing($contact->wa_id, $wamid, 'text', $text, 'reply');
            }
        } catch (\RuntimeException $e) {
            report($e);

            return response()->json(['message' => Str::limit($e->getMessage(), 300)], 502);
        }

        return response()->json(['data' => collect($sent)->map(fn ($m) => $this->message($m))->values()], 201);
    }

    /** Who this number belongs to, when the dashboard knows better than its phone. */
    public function link(Request $request, WhatsAppContact $contact): JsonResponse
    {
        $data = $request->validate(['client_id' => ['nullable', 'integer', 'exists:clients,id']]);

        $contact->forceFill(['client_id' => $data['client_id']])->save();

        return response()->json(['data' => $this->contact($contact->load('client:id,name', 'latestMessage'))]);
    }

    /**
     * A file from a conversation, decrypted and handed over. Followed as a
     * link or an <img>, so it lives on the web routes and checks the
     * session itself, like attachments.
     */
    public function media(WhatsAppMessage $message): Response
    {
        abort_unless(Auth::guard('web')->check(), 403);
        abort_unless($message->media_path, 404);

        try {
            $stored = Storage::disk('files')->get($message->media_path);
        } catch (Throwable) {
            $stored = null;
        }
        abort_if($stored === null, 404);

        $mime = $message->media_mime ?: 'application/octet-stream';
        // Pictures, sound and video are shown in the page; anything else is
        // a download, never rendered.
        $inline = preg_match('#^(image/(jpeg|png|webp|gif)|audio/|video/)#', $mime) === 1;
        $name = str_replace('"', '', $message->media_name ?: "whatsapp-{$message->id}");

        return response(Crypt::decryptString($stored), 200, [
            'Content-Type' => $inline ? $mime : 'application/octet-stream',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.$name.'"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; media-src 'self'",
            'Cache-Control' => 'private, no-store',
        ]);
    }

    /** Tells their phone the latest message was read. Best effort. */
    private function blueTicks(WhatsAppContact $contact): void
    {
        $last = $contact->messages()->where('direction', 'in')->latest('sent_at')->value('wamid');
        if (! $last) {
            return;
        }

        try {
            WhatsAppClient::fromConfig()->markRead($last);
        } catch (Throwable $e) {
            report($e);
        }
    }

    /** @return array<string, mixed> */
    private function contact(WhatsAppContact $c): array
    {
        $last = $c->latestMessage;

        return [
            'id' => $c->id,
            'wa_id' => $c->wa_id,
            'name' => $c->name,
            'client' => $c->client ? ['id' => $c->client->id, 'name' => (string) $c->client->name] : null,
            // The agency's own number: where the reminders go.
            'is_self' => $c->wa_id === WhatsAppSettings::recipient(),
            'unread' => (int) $c->unread,
            'last_message_at' => $c->last_message_at?->toIso8601String(),
            'reply_until' => $c->canReply() ? $c->replyWindowEndsAt()->toIso8601String() : null,
            'last' => $last ? [
                'direction' => $last->direction,
                'type' => $last->type,
                'body' => $last->body ? Str::limit($last->body, 90) : null,
                'status' => $last->status,
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    private function message(WhatsAppMessage $m): array
    {
        return [
            'id' => $m->id,
            'wamid' => $m->wamid,
            'direction' => $m->direction,
            'type' => $m->type,
            'body' => $m->body,
            'media' => $m->media_path || $m->media_name ? [
                'available' => (bool) $m->media_path,
                'mime' => $m->media_mime,
                'name' => $m->media_name,
                'size' => $m->media_size,
            ] : null,
            'extra' => $m->extra,
            'status' => $m->status,
            'error' => $m->error,
            'context_wamid' => $m->context_wamid,
            'source' => $m->source,
            'document_id' => $m->document_id,
            'sent_at' => $m->sent_at?->toIso8601String(),
        ];
    }
}
