<?php

namespace Tests\Feature;

use App\Models\Lead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The contact form is open to the internet; the Turnstile check is what tells
 * a visitor from a script.
 */
class TurnstileTest extends TestCase
{
    use RefreshDatabase;

    private const VERIFY = 'challenges.cloudflare.com/*';

    private function enable(): void
    {
        config([
            'services.turnstile.secret' => 'test-secret-not-real',
            'services.turnstile.hostnames' => ['jalimx.com', 'www.jalimx.com'],
            'services.leads.notify' => null,
        ]);
    }

    /** @return array<string, string> */
    private function enquiry(array $extra = []): array
    {
        return [
            'name' => 'Test Person',
            'email' => 'test@example.test',
            'phone' => '0600000000',
            'message' => 'A message that is long enough to pass.',
            ...$extra,
        ];
    }

    public function test_without_a_secret_the_form_works_as_before(): void
    {
        Http::fake();

        $this->postJson('/api/v1/leads', $this->enquiry())->assertCreated();

        Http::assertNothingSent();
        $this->assertSame(1, Lead::count());
    }

    public function test_with_a_secret_a_missing_token_is_refused(): void
    {
        $this->enable();
        Http::fake();

        $this->postJson('/api/v1/leads', $this->enquiry())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('turnstile');

        $this->assertSame(0, Lead::count());
        // No token, nothing to ask Cloudflare about.
        Http::assertNothingSent();
    }

    public function test_a_token_cloudflare_rejects_is_refused(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => Http::response(['success' => false, 'error-codes' => ['invalid-input-response']])]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'bad']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('turnstile');

        $this->assertSame(0, Lead::count());
    }

    public function test_a_genuine_token_from_our_site_is_accepted(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => Http::response(['success' => true, 'hostname' => 'www.jalimx.com'])]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'good']))->assertCreated();

        $this->assertSame(1, Lead::count());
        // The secret and the token go to Cloudflare, and only there.
        Http::assertSent(fn ($request) => $request['secret'] === 'test-secret-not-real'
            && $request['response'] === 'good');
    }

    public function test_a_token_made_on_someone_elses_site_is_refused(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => Http::response(['success' => true, 'hostname' => 'evil.example'])]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'good']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('turnstile');

        $this->assertSame(0, Lead::count());
    }

    public function test_cloudflare_being_down_does_not_cost_us_the_enquiry(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => Http::response('', 503)]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'good']))->assertCreated();

        $this->assertSame(1, Lead::count());
    }

    public function test_an_unreachable_cloudflare_does_not_cost_us_the_enquiry(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => fn () => throw new ConnectionException('timed out')]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'good']))->assertCreated();

        $this->assertSame(1, Lead::count());
    }

    public function test_a_form_that_fails_its_own_rules_does_not_spend_the_token(): void
    {
        $this->enable();
        Http::fake();

        $this->postJson('/api/v1/leads', $this->enquiry(['message' => 'short', 'turnstile_token' => 'good']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('message')
            ->assertJsonMissingValidationErrors('turnstile');

        Http::assertNothingSent();
    }

    public function test_the_token_is_never_stored_with_the_lead(): void
    {
        $this->enable();
        Http::fake([self::VERIFY => Http::response(['success' => true, 'hostname' => 'jalimx.com'])]);

        $this->postJson('/api/v1/leads', $this->enquiry(['turnstile_token' => 'secret-token-value']))->assertCreated();

        $this->assertStringNotContainsString('secret-token-value', json_encode(Lead::first()->getAttributes()));
    }
}
