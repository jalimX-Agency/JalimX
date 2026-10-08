<?php

namespace Tests\Feature;

use App\Http\Middleware\RequireSiteKey;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public reads answer the site and nobody else — and never hand back the
 * settings that are not for the public.
 */
class SiteKeyTest extends TestCase
{
    use RefreshDatabase;

    private const SECRET = 'test-secret-not-real';

    private function enforce(bool $on = true): void
    {
        config([
            'services.frontend.enforce_site_key' => $on,
            'services.frontend.revalidate_secret' => self::SECRET,
        ]);
    }

    public function test_without_enforcement_the_reads_stay_open(): void
    {
        $this->enforce(false);

        $this->getJson('/api/v1/settings')->assertOk();
    }

    public function test_enforced_reads_refuse_a_request_with_no_key(): void
    {
        $this->enforce();

        foreach (['settings', 'services', 'projects', 'testimonials'] as $path) {
            $this->getJson("/api/v1/{$path}")->assertUnauthorized();
        }
    }

    public function test_enforced_reads_refuse_a_wrong_key(): void
    {
        $this->enforce();

        $this->getJson('/api/v1/settings', ['X-Site-Key' => 'nope'])->assertUnauthorized();
        // The secret itself is not the key.
        $this->getJson('/api/v1/settings', ['X-Site-Key' => self::SECRET])->assertUnauthorized();
    }

    public function test_enforced_reads_answer_the_right_key(): void
    {
        $this->enforce();
        $key = RequireSiteKey::token(self::SECRET);

        foreach (['settings', 'services', 'projects', 'testimonials'] as $path) {
            $this->getJson("/api/v1/{$path}", ['X-Site-Key' => $key])->assertOk();
        }
    }

    public function test_enforcing_without_a_secret_lets_nothing_in(): void
    {
        config([
            'services.frontend.enforce_site_key' => true,
            'services.frontend.revalidate_secret' => null,
        ]);

        $this->getJson('/api/v1/settings', ['X-Site-Key' => RequireSiteKey::token('')])->assertUnauthorized();
    }

    public function test_the_health_check_and_the_contact_form_are_not_behind_the_key(): void
    {
        $this->enforce();

        $this->getJson('/api/v1/health')->assertOk();
        // Reaches validation rather than being turned away at the door.
        $this->postJson('/api/v1/leads', [])->assertUnprocessable();
    }

    public function test_the_public_settings_never_include_private_ones(): void
    {
        $this->enforce(false);

        Setting::create(['key' => 'contact_email', 'value' => ['value' => 'hello@example.test']]);
        Setting::create(['key' => 'whatsapp', 'value' => ['recipient' => '212600000000']]);
        Setting::create(['key' => 'billing_profile', 'value' => ['rib' => '000000000000']]);

        $data = $this->getJson('/api/v1/settings')->assertOk()->json('data');

        $this->assertArrayHasKey('contact_email', $data);
        $this->assertArrayNotHasKey('whatsapp', $data);
        $this->assertArrayNotHasKey('billing_profile', $data);
    }
}
