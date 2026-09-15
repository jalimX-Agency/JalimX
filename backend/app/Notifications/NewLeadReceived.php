<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The email that says someone filled in the form.
 *
 * Short on purpose: who, how to reach them, and a link to the lead. The full
 * message lives in the dashboard, so a forwarded or leaked inbox carries as
 * little of the enquiry as it can.
 */
class NewLeadReceived extends Notification
{
    public function __construct(public Lead $lead) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $lead = $this->lead;
        $dashboard = rtrim((string) config('services.frontend.url'), '/').'/admin/leads/'.$lead->id;

        return (new MailMessage)
            ->subject("New enquiry — {$lead->name}".($lead->company ? " ({$lead->company})" : ''))
            ->replyTo($lead->email, $lead->name)
            ->line("{$lead->name} sent the contact form.")
            ->line('Service: '.($lead->service_interest ?: '—').' · Budget: '.($lead->budget_range ?: '—'))
            ->line("Phone: {$lead->phone}")
            ->action('Open in the dashboard', $dashboard);
    }
}
