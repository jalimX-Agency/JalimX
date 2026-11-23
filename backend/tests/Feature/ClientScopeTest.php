<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\Document;
use App\Models\Task;
use App\Models\User;
use App\Models\WhatsAppContact;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

/** A role limited to assigned clients reaches those clients and nothing else. */
class ClientScopeTest extends TestCase
{
    use RefreshDatabase;

    private Client $mine;

    private Client $other;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mine = Client::create(['name' => 'Villa Mine', 'country' => 'Morocco', 'currency' => 'MAD']);
        $this->other = Client::create(['name' => 'Camp Other', 'country' => 'Morocco', 'currency' => 'MAD']);
    }

    private function member(array $permissions, string $scope = 'assigned'): User
    {
        $role = Role::create(['name' => 'Role '.uniqid(), 'guard_name' => 'web']);
        $role->forceFill(['client_scope' => $scope])->save();
        $role->syncPermissions($permissions);

        $user = User::factory()->create();
        $user->assignRole($role);
        $user->clients()->sync([$this->mine->id]);

        return $user;
    }

    public function test_the_client_list_holds_only_assigned_clients(): void
    {
        Sanctum::actingAs($this->member(['clients.view']));

        $names = collect($this->getJson('/api/v1/admin/clients')->assertOk()->json('data'))->pluck('name');

        $this->assertEquals(['Villa Mine'], $names->all());
    }

    public function test_another_clients_page_does_not_exist_for_them(): void
    {
        Sanctum::actingAs($this->member(['clients.view']));

        $this->getJson("/api/v1/admin/clients/{$this->mine->id}")->assertOk();
        $this->getJson("/api/v1/admin/clients/{$this->other->id}")->assertNotFound();
    }

    public function test_a_role_on_every_client_still_sees_every_client(): void
    {
        Sanctum::actingAs($this->member(['clients.view'], 'all'));

        $this->assertCount(2, $this->getJson('/api/v1/admin/clients')->json('data'));
    }

    public function test_invoices_of_another_client_are_out_of_reach(): void
    {
        $doc = Document::create([
            'client_id' => $this->other->id, 'type' => 'invoice', 'status' => 'draft',
            'currency' => 'MAD', 'issued_on' => now(),
        ]);
        Sanctum::actingAs($this->member(['clients.view', 'money.view', 'money.manage']));

        $this->deleteJson("/api/v1/admin/documents/{$doc->id}")->assertNotFound();
        $this->assertNotNull($doc->fresh());
    }

    public function test_tasks_are_those_of_their_clients_and_new_ones_must_be_linked(): void
    {
        Task::create(['title' => 'Mine', 'client_id' => $this->mine->id, 'status' => 'todo', 'priority' => 'normal']);
        Task::create(['title' => 'Other', 'client_id' => $this->other->id, 'status' => 'todo', 'priority' => 'normal']);
        Task::create(['title' => 'Nobody', 'status' => 'todo', 'priority' => 'normal']);
        Sanctum::actingAs($this->member(['tasks.view', 'tasks.manage']));

        $titles = collect($this->getJson('/api/v1/admin/tasks')->assertOk()->json('data'))->pluck('title')->all();
        $this->assertEquals(['Mine'], $titles);

        $this->postJson('/api/v1/admin/tasks', ['title' => 'Loose'])->assertUnprocessable()->assertJsonValidationErrors('client_id');
        $this->postJson('/api/v1/admin/tasks', ['title' => 'Elsewhere', 'client_id' => $this->other->id])->assertUnprocessable();
        $this->postJson('/api/v1/admin/tasks', ['title' => 'Fine', 'client_id' => $this->mine->id])->assertCreated();
    }

    public function test_the_inbox_shows_their_clients_conversations_and_counts_only_those(): void
    {
        WhatsAppContact::create(['wa_id' => '212600000001', 'client_id' => $this->mine->id, 'last_message_at' => now(), 'unread' => 2]);
        WhatsAppContact::create(['wa_id' => '212600000002', 'client_id' => $this->other->id, 'last_message_at' => now(), 'unread' => 5]);
        $unlinked = WhatsAppContact::create(['wa_id' => '212600000003', 'last_message_at' => now(), 'unread' => 1]);

        Sanctum::actingAs($this->member(['inbox.view']));
        $res = $this->getJson('/api/v1/admin/inbox')->assertOk();
        $this->assertCount(1, $res->json('data'));
        $res->assertJsonPath('unread', 2);
        $this->getJson('/api/v1/admin/inbox/pulse')->assertJsonPath('data.unread', 2);
        $this->getJson("/api/v1/admin/inbox/{$unlinked->id}")->assertNotFound();

        // With the permission for unlinked numbers, those appear too.
        Sanctum::actingAs($this->member(['inbox.view', 'inbox.unlinked']));
        $this->assertCount(2, $this->getJson('/api/v1/admin/inbox')->json('data'));
        $this->getJson('/api/v1/admin/inbox/pulse')->assertJsonPath('data.unread', 3);
    }

    public function test_a_client_they_create_is_assigned_to_them(): void
    {
        $user = $this->member(['clients.view', 'clients.manage']);
        Sanctum::actingAs($user);

        $id = $this->postJson('/api/v1/admin/clients', ['name' => 'New Riad', 'country' => 'Morocco', 'currency' => 'MAD'])
            ->assertCreated()->json('data.id');

        $this->assertTrue($user->clients()->whereKey($id)->exists());
        $this->getJson("/api/v1/admin/clients/{$id}")->assertOk();
    }

    public function test_the_team_page_assigns_clients_and_sets_the_role_scope(): void
    {
        $member = $this->member(['tasks.view']);
        Sanctum::actingAs(User::factory()->owner()->create());

        $this->patchJson("/api/v1/admin/team/{$member->id}", ['client_ids' => [$this->other->id]])
            ->assertOk()->assertJsonPath('data.client_ids', [$this->other->id])
            ->assertJsonPath('data.sees_all_clients', false);

        $this->postJson('/api/v1/admin/roles', ['name' => 'Designer', 'permissions' => ['clients.view'], 'client_scope' => 'assigned'])
            ->assertCreated()->assertJsonFragment(['name' => 'Designer', 'client_scope' => 'assigned']);
    }
}
