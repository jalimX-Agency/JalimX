<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The answer to someone who used the contact form.
 *
 * The text is whatever the person wrote (or drafted with AI and edited), in
 * the language of the enquiry. The one thing added around it is the button
 * that opens WhatsApp on the agency's number with a first line already
 * written, so the conversation can carry on there.
 */
class LeadReplyMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $subjectLine,
        public string $body,
        public string $language,
        public ?string $whatsappUrl = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectLine,
            // It comes from noreply@; the answer to it should reach a person.
            replyTo: [new Address(config('mail.client_reply_to'), config('app.name'))],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.lead-reply',
            with: [
                // Single line breaks are kept: Markdown would fold them.
                'body' => preg_replace("/(?<!\n)\n(?!\n)/", "  \n", trim($this->body)),
                'whatsappUrl' => $this->whatsappUrl,
                'buttonLabel' => $this->language === 'fr' ? 'Continuer sur WhatsApp' : 'Continue on WhatsApp',
            ],
        );
    }
}
