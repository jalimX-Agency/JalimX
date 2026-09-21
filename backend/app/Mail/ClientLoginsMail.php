<?php

namespace App\Mail;

use App\Models\Client;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The client's access details, as a protected PDF.
 *
 * The password for the PDF is deliberately not in here. The message says
 * so, and says it will arrive another way, so the client does not go
 * looking for it in their inbox and reply asking.
 *
 * In French, like the invoices: it is read by the client, not by us.
 */
class ClientLoginsMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Client $client,
        public string $pdf,
        public string $filename,
        public int $count,
        public ?string $note = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Vos accès — '.$this->client->name,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.client-logins',
            with: [
                'name' => $this->client->contact_name ?: $this->client->name,
                'count' => $this->count,
                'note' => $this->note,
            ],
        );
    }

    /** @return array<int, Attachment> */
    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdf, $this->filename)
                ->withMime('application/pdf'),
        ];
    }
}
