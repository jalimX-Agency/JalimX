<?php

namespace Tests\Feature;

use App\AI\AiResult;
use App\AI\Tasks\LeadReply;
use App\Mail\LeadReplyMail;
use App\Models\Lead;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Answering an enquiry by email, with the WhatsApp button. */
class LeadReplyTest extends TestCase
{
    use RefreshDatabase;

    private function lead(array $extra = []): Lead
    {
        return Lead::create([
            'name' => 'Salma Idrissi',
            'email' => 'salma@example.test',
            'phone' => '0612345678',
            'message' => 'We run a riad and need a booking site.',
            'status' => 'new',
            'locale' => 'fr',
            ...$extra,
        ]);
    }

    private function whatsapp(): void
    {
        Setting::updateOrCreate(['key' => 'contact_whatsapp'], ['value' => ['values' => ['+212 620-569446']]]);
    }

    public function test_the_reply_goes_to_the_lead_and_marks_them_contacted(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create());
        $lead = $this->lead();

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", [
            'subject' => 'Votre site de réservation',
            'body' => "Bonjour Salma,\nMerci pour votre message.",
        ])->assertOk()
            ->assertJsonPath('data.status', 'contacted')
            ->assertJsonPath('data.replies.0.subject', 'Votre site de réservation');

        Mail::assertSent(LeadReplyMail::class, fn (LeadReplyMail $m) => $m->hasTo('salma@example.test')
            && $m->whatsappUrl === null);
        $this->assertSame(1, $lead->replies()->count());
    }

    public function test_the_whatsapp_button_opens_a_chat_with_the_agency(): void
    {
        Mail::fake();
        $this->whatsapp();
        Sanctum::actingAs(User::factory()->create());
        $lead = $this->lead();

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", [
            'subject' => 'Hello',
            'body' => 'A reply long enough.',
            'whatsapp' => true,
        ])->assertOk();

        Mail::assertSent(LeadReplyMail::class, fn (LeadReplyMail $m) => str_starts_with((string) $m->whatsappUrl, 'https://wa.me/212620569446?text=')
            && str_contains((string) $m->whatsappUrl, rawurlencode('Salma Idrissi')));
    }

    public function test_a_whatsapp_button_without_a_number_is_refused_and_nothing_is_sent(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create());
        $lead = $this->lead();

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", [
            'subject' => 'Hello',
            'body' => 'A reply long enough.',
            'whatsapp' => true,
        ])->assertUnprocessable();

        Mail::assertNothingSent();
        $this->assertSame('new', $lead->fresh()->status);
    }

    public function test_a_later_stage_is_not_moved_back(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->create());
        $lead = $this->lead(['status' => 'quoted']);

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", [
            'subject' => 'Follow-up',
            'body' => 'A reply long enough.',
        ])->assertOk()->assertJsonPath('data.status', 'quoted');
    }

    public function test_it_needs_a_subject_and_a_body(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $lead = $this->lead();

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", ['subject' => '', 'body' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['subject', 'body']);
    }

    public function test_a_signed_out_visitor_cannot_send(): void
    {
        $lead = $this->lead();

        $this->postJson("/api/v1/admin/leads/{$lead->id}/reply", ['subject' => 'x', 'body' => 'a reply'])
            ->assertUnauthorized();
    }

    public function test_the_draft_is_split_into_subject_and_body(): void
    {
        $result = new AiResult(
            text: "Subject: Votre projet de site\n\nBonjour Salma,\n\nMerci pour votre message.\n\nMohamed",
            model: 'test',
            credentialLabel: 'test',
        );

        $draft = (new LeadReply)->parse($result, []);

        $this->assertSame('Votre projet de site', $draft['subject']);
        $this->assertStringStartsWith('Bonjour Salma,', $draft['body']);
        $this->assertStringNotContainsString('Subject', $draft['body']);
    }
}
