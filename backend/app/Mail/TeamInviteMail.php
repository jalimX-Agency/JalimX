<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** "You have been added to the JalimX dashboard": the link to choose a password. */
class TeamInviteMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public User $member,
        public string $url,
        public ?string $invitedBy,
        public string $role,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'You have been invited to the JalimX dashboard',
            replyTo: [new Address(config('mail.client_reply_to'), config('app.name'))],
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'mail.team-invite',
            with: [
                'name' => $this->member->name,
                'url' => $this->url,
                'invitedBy' => $this->invitedBy,
                'role' => $this->role,
                'expires' => $this->member->invite_expires_at?->format('j M Y'),
            ],
        );
    }
}
