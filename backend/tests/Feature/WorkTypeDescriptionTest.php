<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WorkType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkTypeDescriptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_kind_of_work_keeps_its_description(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $seo = WorkType::where('slug', 'seo')->firstOrFail();

        $this->putJson("/api/v1/admin/work-types/{$seo->id}", [
            'name' => 'SEO',
            'description' => 'Local SEO and the Google Business Profile, measured monthly.',
            'needs_logins' => true,
            'is_active' => true,
        ])->assertOk()->assertJsonPath('data.description', 'Local SEO and the Google Business Profile, measured monthly.');

        $this->getJson('/api/v1/admin/work-types')
            ->assertOk()
            ->assertJsonFragment(['description' => 'Local SEO and the Google Business Profile, measured monthly.']);
    }
}
