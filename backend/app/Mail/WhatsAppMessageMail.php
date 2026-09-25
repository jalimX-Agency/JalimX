<?php

namespace App\Mail;

use App\Models\WhatsAppContact;
use App\Models\WhatsAppMessage;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * "Someone wrote on WhatsApp." To the agency, in English like the
 * dashboard it points to. The message itself is quoted so the common
 * case — a short question — can be read without opening anything.
 */
class WhatsAppMessageMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public WhatsAppContact $contact,
        public WhatsAppMessage $message,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'WhatsApp from '.$this->who().': '.Str::limit($this->preview(), 60));
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.whatsapp-message',
            with: [
                'who' => $this->who(),
                'number' => '+'.$this->contact->wa_id,
                'client' => $this->contact->client?->name,
                'preview' => $this->preview(),
                'url' => rtrim((string) config('services.frontend.url'), '/').'/admin/inbox?c='.$this->contact->id,
            ],
        );
    }

    private function who(): string
    {
        return $this->contact->client?->name
            ?? $this->contact->name
            ?? '+'.$this->contact->wa_id;
    }

    private function preview(): string
    {
        $m = $this->message;
        $label = [
            'image' => '📷 Photo', 'video' => '🎬 Video', 'audio' => '🎤 Voice message',
            'document' => '📄 '.($m->media_name ?: 'Document'), 'sticker' => 'Sticker',
            'location' => '📍 Location', 'contacts' => '👤 Contact', 'unsupported' => 'A message the dashboard cannot show',
        ][$m->type] ?? null;

        return trim(implode(' — ', array_filter([$label, $m->body]))) ?: 'New message';
    }
}
