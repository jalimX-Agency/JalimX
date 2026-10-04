<?php

namespace Tests\Feature;

use App\AI\AIManager;
use App\AI\AiRequest;
use App\AI\CredentialStatus;
use App\AI\Exceptions\AiRequestFailed;
use App\AI\Exceptions\AiUnavailable;
use App\AI\PrivacyShield;
use App\Models\AiCredential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AiCredentialPoolTest extends TestCase
{
    use RefreshDatabase;

    private const GEMINI_OK = ['candidates' => [['content' => ['parts' => [['text' => 'Hello there']]], 'finishReason' => 'STOP']]];

    private function key(string $label, string $provider, string $secret, int $priority, array $extra = []): AiCredential
    {
        $c = new AiCredential([
            'label' => $label,
            'provider' => $provider,
            'model' => $provider === 'gemini' ? 'gemini-2.5-flash' : 'llama-3.3-70b-versatile',
            'priority' => $priority,
            'status' => CredentialStatus::Active,
        ]);
        $c->forceFill($extra);
        $c->setKey($secret);
        $c->save();

        return $c;
    }

    private function ask(): string
    {
        return app(AIManager::class)->complete(new AiRequest('system', 'prompt'), 'test')->text;
    }

    public function test_a_rate_limited_key_rests_and_the_next_one_answers(): void
    {
        $first = $this->key('Gemini #1', 'gemini', 'AIzaFIRSTkeyFIRSTkeyFIRSTkey000', 1);
        $second = $this->key('Gemini #2', 'gemini', 'AIzaSECONDkeySECONDkeySECOND00', 2);

        Http::fake(function (Request $request) {
            return $request->header('x-goog-api-key')[0] === 'AIzaFIRSTkeyFIRSTkeyFIRSTkey000'
                ? Http::response(['error' => [
                    'code' => 429, 'status' => 'RESOURCE_EXHAUSTED', 'message' => 'Quota exceeded',
                    'details' => [['@type' => 'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay' => '37s']],
                ]], 429)
                : Http::response(self::GEMINI_OK);
        });

        $this->assertSame('Hello there', $this->ask());

        $first->refresh();
        $this->assertSame(CredentialStatus::CoolingDown, $first->status);
        $this->assertEqualsWithDelta(37, now()->diffInSeconds($first->available_at), 2);
        $this->assertSame(CredentialStatus::Active, $second->refresh()->status);
        $this->assertNotNull($second->last_success_at);

        // The key travels in a header, never in the URL.
        Http::assertSent(fn (Request $r) => ! str_contains($r->url(), 'key='));
    }

    public function test_a_resting_key_is_skipped_until_its_rest_is_over(): void
    {
        $this->key('Resting', 'gemini', 'AIzaRESTINGkeyRESTINGkeyREST00', 1, [
            'status' => CredentialStatus::CoolingDown, 'available_at' => now()->addMinutes(5),
        ]);
        $this->key('Groq', 'groq', 'gsk_groqkeygroqkeygroqkey0000', 2);

        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'From Groq']]]])]);

        $this->assertSame('From Groq', $this->ask());
        Http::assertSentCount(1);

        $this->travel(6)->minutes();
        Http::fake(['generativelanguage.googleapis.com/*' => Http::response(self::GEMINI_OK)]);
        $this->assertSame('Hello there', $this->ask());
    }

    public function test_a_refused_key_is_marked_invalid_and_skipped(): void
    {
        $bad = $this->key('Bad', 'gemini', 'AIzaBADkeyBADkeyBADkeyBADkey00', 1);
        $this->key('Groq', 'groq', 'gsk_groqkeygroqkeygroqkey0000', 2);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response(['error' => [
                'code' => 400, 'status' => 'INVALID_ARGUMENT', 'message' => 'API key not valid.',
                'details' => [['@type' => 'type.googleapis.com/google.rpc.ErrorInfo', 'reason' => 'API_KEY_INVALID']],
            ]], 400),
            'api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'From Groq']]]]),
        ]);

        $this->assertSame('From Groq', $this->ask());
        $this->assertSame(CredentialStatus::Invalid, $bad->refresh()->status);
        $this->assertSame('auth', $bad->last_error_type);
    }

    public function test_a_malformed_request_does_not_burn_the_other_keys(): void
    {
        $this->key('Groq #1', 'groq', 'gsk_groqkeyONEgroqkeyONE00000', 1);
        $other = $this->key('Groq #2', 'groq', 'gsk_groqkeyTWOgroqkeyTWO00000', 2);

        Http::fake(['api.groq.com/*' => Http::response(['error' => ['message' => 'messages: invalid content', 'type' => 'invalid_request_error']], 400)]);

        try {
            $this->ask();
            $this->fail('Expected the request to be refused.');
        } catch (AiRequestFailed) {
            Http::assertSentCount(1);
            $this->assertSame(CredentialStatus::Active, $other->refresh()->status);
            $this->assertNull($other->last_used_at);
        }
    }

    public function test_with_no_keys_it_says_how_to_add_one(): void
    {
        $this->expectException(AiUnavailable::class);
        $this->expectExceptionMessage('Settings → AI providers');

        $this->ask();
    }

    public function test_keys_are_encrypted_at_rest_and_never_returned(): void
    {
        $secret = 'gsk_THISISTHESECRETKEYVALUE12345';
        $this->key('Groq', 'groq', $secret, 1);

        $this->assertStringNotContainsString($secret, (string) DB::table('ai_credentials')->value('api_key'));

        Sanctum::actingAs($this->owner());
        $response = $this->getJson('/api/v1/admin/ai/credentials')->assertOk();

        $this->assertStringNotContainsString($secret, $response->getContent());
        $response->assertJsonPath('data.0.key_hint', '••••2345');
    }

    public function test_a_key_the_provider_refuses_is_not_saved_as_active(): void
    {
        Sanctum::actingAs($this->owner());
        Http::fake(['api.groq.com/*' => Http::response(['error' => ['message' => 'Invalid API Key', 'code' => 'invalid_api_key']], 401)]);

        $payload = ['label' => 'Groq', 'provider' => 'groq', 'model' => 'llama-3.3-70b-versatile', 'api_key' => 'gsk_wrongwrongwrongwrong00'];

        $this->postJson('/api/v1/admin/ai/credentials', $payload)
            ->assertStatus(422)
            ->assertJsonPath('test.checks.0.ok', false);
        $this->assertDatabaseCount('ai_credentials', 0);

        $this->postJson('/api/v1/admin/ai/credentials', [...$payload, 'save_anyway' => true])->assertCreated();
        $this->assertSame(CredentialStatus::Disabled, AiCredential::first()->status);
    }

    public function test_a_custom_address_on_a_private_network_is_refused(): void
    {
        Sanctum::actingAs($this->owner());

        $this->postJson('/api/v1/admin/ai/credentials', [
            'label' => 'Gateway', 'provider' => 'custom', 'model' => 'x',
            'base_url' => 'https://169.254.169.254/v1', 'api_key' => 'sk-whateverwhatever00',
        ])->assertStatus(422)->assertJsonValidationErrors('base_url');
    }

    public function test_managing_keys_needs_the_permission(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/v1/admin/ai/credentials')->assertForbidden();
        $this->postJson('/api/v1/admin/ai/assist', ['action' => 'write'])->assertForbidden();
    }

    public function test_assist_writes_into_a_field(): void
    {
        Sanctum::actingAs($this->owner());
        $this->key('Groq', 'groq', 'gsk_groqkeygroqkeygroqkey0000', 1);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => '"A desert camp, sold a night at a time."']]]])]);

        $this->postJson('/api/v1/admin/ai/assist', [
            'action' => 'write',
            'field' => ['label' => 'Headline', 'lang' => 'en', 'max_length' => 160],
        ])->assertOk()
            ->assertJsonPath('data.text', 'A desert camp, sold a night at a time.')
            ->assertJsonPath('data.source', 'Groq');

        $this->assertDatabaseHas('ai_requests', ['task' => 'text_assist', 'outcome' => 'ok']);
    }

    private function owner(): User
    {
        $user = User::factory()->create();
        $user->assignRole('owner');

        return $user;
    }

    public function test_personal_data_is_masked_on_the_way_out_and_restored_on_the_way_back(): void
    {
        $this->key('Groq', 'groq', 'gsk_groqkeygroqkeygroqkey0000', 1);

        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'Write to [EMAIL_1] or call [PHONE_1].']]]])]);

        $text = app(AIManager::class)->complete(
            new AiRequest('system', 'Reply to sara@example.com, phone +212 6 12 34 56 78, IBAN MA64 0115 1900 0001 2050 0053 4921.'),
            'test',
        )->text;

        Http::assertSent(function (Request $r) {
            $body = json_encode($r->data());

            return ! str_contains($body, 'sara@example.com')
                && ! str_contains($body, '12 34 56 78')
                && ! str_contains($body, '0115 1900')
                && str_contains($body, '[EMAIL_1]');
        });
        $this->assertSame('Write to sara@example.com or call +212 6 12 34 56 78.', $text);
    }

    public function test_a_key_trusted_with_personal_data_receives_it_as_it_is(): void
    {
        $this->key('Paid', 'groq', 'gsk_paidkeypaidkeypaidkey0000', 1, ['allows_personal_data' => true]);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'ok']]]])]);

        app(AIManager::class)->complete(new AiRequest('system', 'Reply to sara@example.com'), 'test');

        Http::assertSent(fn (Request $r) => str_contains(json_encode($r->data()), 'sara@example.com'));
    }

    public function test_prices_years_and_dates_are_not_taken_for_phone_numbers(): void
    {
        $shield = new PrivacyShield;
        $text = 'From 1 200 MAD per night in 2026, open 08:00-18:00, 4.9 from 105 reviews.';

        $this->assertSame($text, $shield->mask($text));
    }

    public function test_a_key_that_can_no_longer_be_decrypted_is_skipped_not_fatal(): void
    {
        $broken = $this->key('Old', 'groq', 'gsk_oldkeyoldkeyoldkeyold0000', 1);
        // As if APP_KEY changed after this key was saved.
        DB::table('ai_credentials')->where('id', $broken->id)->update(['api_key' => 'not-a-valid-payload']);
        $this->key('New', 'groq', 'gsk_newkeynewkeynewkeynew0000', 2);

        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'From the new key']]]])]);

        $this->assertSame('From the new key', $this->ask());
        $this->assertSame(CredentialStatus::Invalid, $broken->refresh()->status);
        $this->assertStringContainsString('APP_KEY', $broken->last_error_note);
    }

    public function test_an_unreadable_key_can_be_replaced_from_the_dashboard(): void
    {
        Sanctum::actingAs($this->owner());
        $broken = $this->key('Old', 'groq', 'gsk_oldkeyoldkeyoldkeyold0000', 1);
        DB::table('ai_credentials')->where('id', $broken->id)->update(['api_key' => 'not-a-valid-payload']);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'ok']]]])]);

        $this->putJson("/api/v1/admin/ai/credentials/{$broken->id}", [
            'label' => 'Old', 'provider' => 'groq', 'model' => 'llama-3.3-70b-versatile',
            'api_key' => 'gsk_replacementreplacement00',
        ])->assertOk()->assertJsonPath('data.status', 'active');

        $this->assertSame('gsk_replacementreplacement00', $broken->fresh()->api_key);
    }

    public function test_a_written_request_is_followed_and_needs_words(): void
    {
        Sanctum::actingAs($this->owner());
        $this->key('Groq', 'groq', 'gsk_groqkeygroqkeygroqkey0000', 1);
        Http::fake(['api.groq.com/*' => Http::response(['choices' => [['message' => ['content' => 'Warmer text']]]])]);

        $this->postJson('/api/v1/admin/ai/assist', ['action' => 'custom', 'text' => 'Cold text'])
            ->assertStatus(422)->assertJsonValidationErrors('instruction');

        $this->postJson('/api/v1/admin/ai/assist', [
            'action' => 'custom',
            'instruction' => 'Make it warmer and mention the pool',
            'text' => 'Cold text',
        ])->assertOk()->assertJsonPath('data.text', 'Warmer text');

        Http::assertSent(fn (Request $r) => str_contains($r['messages'][1]['content'], "<request>\nMake it warmer and mention the pool\n</request>"));
    }
}
