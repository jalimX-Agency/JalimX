<?php

namespace Tests\Feature;

use App\Mail\TeamInviteMail;
use App\Models\Client;
use App\Models\Credential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/** Roles built on the Team page, invites, and what each role may reach. */
class TeamTest extends TestCase
{
    use RefreshDatabase;

    private function role(string $name, array $permissions): Role
    {
        $role = Role::create(['name' => $name, 'guard_name' => 'web']);
        $role->syncPermissions($permissions);

        return $role;
    }

    private function member(array $permissions): User
    {
        $user = User::factory()->create();
        $user->assignRole($this->role('Role '.uniqid(), $permissions));

        return $user;
    }

    public function test_the_owner_creates_a_role_with_the_permissions_chosen(): void
    {
        Sanctum::actingAs(User::factory()->owner()->create());

        $this->postJson('/api/v1/admin/roles', [
            'name' => 'Developer',
            'permissions' => ['clients.view', 'tasks.view', 'tasks.manage'],
        ])->assertCreated()->assertJsonFragment(['name' => 'Developer']);

        $this->assertEqualsCanonicalizing(
            ['clients.view', 'tasks.view', 'tasks.manage'],
            Role::findByName('Developer', 'web')->permissions->pluck('name')->all(),
        );
    }

    public function test_the_owner_role_cannot_be_edited_or_deleted(): void
    {
        Sanctum::actingAs(User::factory()->owner()->create());
        $owner = Role::findByName('owner', 'web');

        $this->putJson("/api/v1/admin/roles/{$owner->id}", ['name' => 'owner', 'permissions' => []])->assertUnprocessable();
        $this->deleteJson("/api/v1/admin/roles/{$owner->id}")->assertUnprocessable();
        $this->postJson('/api/v1/admin/roles', ['name' => 'owner', 'permissions' => []])->assertUnprocessable();
    }

    public function test_a_role_someone_holds_cannot_be_deleted(): void
    {
        Sanctum::actingAs(User::factory()->owner()->create());
        $member = $this->member(['tasks.view']);
        $role = $member->roles->first();

        $this->deleteJson("/api/v1/admin/roles/{$role->id}")->assertUnprocessable();
    }

    public function test_inviting_sends_a_link_that_sets_a_password_and_signs_in(): void
    {
        Mail::fake();
        Sanctum::actingAs(User::factory()->owner()->create());
        $this->role('Developer', ['tasks.view']);

        $url = $this->postJson('/api/v1/admin/team/invites', [
            'name' => 'Yassine',
            'email' => 'yassine@example.test',
            'role' => 'Developer',
        ])->assertCreated()
            ->assertJsonPath('data.member.status', 'invited')
            ->assertJsonPath('data.emailed', true)
            ->json('data.invite_url');

        Mail::assertSent(TeamInviteMail::class, fn ($m) => $m->hasTo('yassine@example.test'));

        $token = explode('token=', $url)[1];
        $this->getJson("/api/v1/invites/{$token}")->assertOk()->assertJsonPath('data.name', 'Yassine');

        $this->postJson('/invite/accept', [
            'token' => $token,
            'password' => 'a-long-password-1',
            'password_confirmation' => 'a-long-password-1',
        ])->assertOk()->assertJsonPath('data.permissions', ['tasks.view']);

        $user = User::where('email', 'yassine@example.test')->first();
        $this->assertSame('active', $user->status());
        // The link worked once.
        $this->getJson("/api/v1/invites/{$token}")->assertStatus(410);
    }

    public function test_an_expired_invite_is_refused(): void
    {
        $user = User::factory()->create([
            'invite_token' => hash('sha256', 'old-token'),
            'invite_expires_at' => now()->subDay(),
        ]);

        $this->getJson('/api/v1/invites/old-token')->assertStatus(410);
        $this->assertNull($user->fresh()->invite_accepted_at);
    }

    public function test_a_member_without_money_gets_no_money(): void
    {
        $client = Client::create(['name' => 'Villa Test', 'country' => 'Morocco', 'currency' => 'MAD']);
        Sanctum::actingAs($this->member(['clients.view']));

        $this->getJson("/api/v1/admin/clients/{$client->id}")
            ->assertOk()
            ->assertJsonMissingPath('data.documents')
            ->assertJsonMissingPath('data.credentials');

        $this->getJson('/api/v1/admin/overview')->assertOk()->assertJsonPath('data.money', null);
        $this->postJson("/api/v1/admin/clients/{$client->id}/documents", [])->assertForbidden();
    }

    public function test_seeing_logins_is_not_the_same_as_seeing_passwords(): void
    {
        $client = Client::create(['name' => 'Villa Test', 'country' => 'Morocco', 'currency' => 'MAD']);
        $login = Credential::create(['client_id' => $client->id, 'label' => 'Hosting', 'secret' => 's3cret']);

        Sanctum::actingAs($this->member(['clients.view', 'logins.view']));
        $this->getJson("/api/v1/admin/clients/{$client->id}")->assertOk()->assertJsonPath('data.credentials.0.label', 'Hosting');
        $this->getJson("/api/v1/admin/credentials/{$login->id}/reveal")->assertForbidden();

        Sanctum::actingAs($this->member(['clients.view', 'logins.view', 'logins.reveal']));
        $this->getJson("/api/v1/admin/credentials/{$login->id}/reveal")->assertOk()->assertJsonPath('data.secret', 's3cret');
    }

    public function test_only_team_managers_reach_the_team(): void
    {
        Sanctum::actingAs($this->member(['tasks.view']));

        $this->getJson('/api/v1/admin/team')->assertForbidden();
        $this->postJson('/api/v1/admin/roles', ['name' => 'X', 'permissions' => []])->assertForbidden();
    }

    public function test_a_team_manager_cannot_make_an_owner_or_touch_one(): void
    {
        $owner = User::factory()->owner()->create();
        Sanctum::actingAs($this->member(['team.manage']));

        $this->postJson('/api/v1/admin/team/invites', [
            'name' => 'X', 'email' => 'x@example.test', 'role' => 'owner',
        ])->assertUnprocessable();

        $this->patchJson("/api/v1/admin/team/{$owner->id}", ['is_active' => false])->assertForbidden();
    }

    public function test_nobody_switches_themselves_off(): void
    {
        $owner = User::factory()->owner()->create();
        Sanctum::actingAs($owner);

        $this->patchJson("/api/v1/admin/team/{$owner->id}", ['is_active' => false])->assertUnprocessable();
        $this->patchJson("/api/v1/admin/team/{$owner->id}", ['role' => 'owner'])->assertUnprocessable();
    }

    public function test_a_switched_off_member_is_refused_and_cannot_sign_in(): void
    {
        $owner = User::factory()->owner()->create();
        $member = $this->member(['tasks.view']);

        Sanctum::actingAs($owner);
        $this->patchJson("/api/v1/admin/team/{$member->id}", ['is_active' => false])->assertOk()
            ->assertJsonPath('data.status', 'disabled');

        Sanctum::actingAs($member->fresh());
        $this->getJson('/api/v1/admin/tasks')->assertUnauthorized();

        $this->postJson('/login', ['email' => $member->email, 'password' => 'password'])->assertUnprocessable();
    }

    public function test_someone_who_signed_in_is_switched_off_not_deleted(): void
    {
        Sanctum::actingAs(User::factory()->owner()->create());
        $member = $this->member(['tasks.view']);
        $member->forceFill(['invite_accepted_at' => now()])->save();

        $this->deleteJson("/api/v1/admin/team/{$member->id}")->assertUnprocessable();
        $this->assertNotNull($member->fresh());
    }
}
