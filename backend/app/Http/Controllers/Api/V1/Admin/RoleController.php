<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Roles the owner builds from the permission list.
 *
 * The owner role is fixed: it holds every permission and cannot be edited or
 * deleted, so nobody can lock the business out of its own dashboard. A role
 * still held by someone cannot be deleted either; move them first.
 */
class RoleController extends Controller
{
    public static function rolesPayload(): array
    {
        // Counted from the pivot directly: Spatie's users() relation resolves
        // its model from the current guard, which is not always "web".
        $counts = self::memberCounts();

        return Role::query()->with('permissions')->orderBy('name')->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'locked' => $role->name === Permissions::OWNER_ROLE,
                'client_scope' => $role->name === Permissions::OWNER_ROLE ? 'all' : ($role->client_scope ?? 'all'),
                'members' => (int) ($counts[$role->id] ?? 0),
                'permissions' => $role->name === Permissions::OWNER_ROLE
                    ? Permissions::all()
                    : $role->permissions->pluck('name')->values()->all(),
            ])
            // The owner first, then the rest by name.
            ->sortBy(fn ($r) => $r['locked'] ? '' : mb_strtolower($r['name']))
            ->values()->all();
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->forceFill(['client_scope' => $data['client_scope']])->save();
        $role->syncPermissions($data['permissions']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => self::rolesPayload()], 201);
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        $this->guardLocked($role);
        $data = $this->validated($request, $role);

        $role->forceFill(['name' => $data['name'], 'client_scope' => $data['client_scope']])->save();
        $role->syncPermissions($data['permissions']);
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => self::rolesPayload()]);
    }

    public function destroy(Role $role): JsonResponse
    {
        $this->guardLocked($role);

        if ((self::memberCounts()[$role->id] ?? 0) > 0) {
            throw ValidationException::withMessages([
                'role' => 'Someone still has this role. Give them another role first.',
            ]);
        }

        $role->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        return response()->json(['data' => self::rolesPayload()]);
    }

    /** @return array<int, int> role id => people holding it */
    private static function memberCounts(): array
    {
        return \Illuminate\Support\Facades\DB::table(config('permission.table_names.model_has_roles'))
            ->selectRaw('role_id, count(*) as total')
            ->groupBy('role_id')
            ->pluck('total', 'role_id')
            ->map(fn ($n) => (int) $n)
            ->all();
    }

    /** @return array{name: string, permissions: list<string>, client_scope: string} */
    private function validated(Request $request, ?Role $role = null): array
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:60',
                Rule::notIn([Permissions::OWNER_ROLE]),
                Rule::unique('roles', 'name')->where('guard_name', 'web')->ignore($role?->id),
            ],
            'permissions' => ['present', 'array'],
            // Every client, or only the clients assigned to each person.
            'client_scope' => ['sometimes', Rule::in(['all', 'assigned'])],
            'permissions.*' => ['string', Rule::in(Permissions::all())],
        ], [
            'name.not_in' => 'That name belongs to the owner role.',
            'name.unique' => 'There is already a role with this name.',
        ]);

        return [
            'name' => trim($data['name']),
            'permissions' => array_values(array_unique($data['permissions'])),
            'client_scope' => $data['client_scope'] ?? 'all',
        ];
    }

    private function guardLocked(Role $role): void
    {
        if ($role->name === Permissions::OWNER_ROLE) {
            throw ValidationException::withMessages(['role' => 'The owner role always has every permission.']);
        }
    }
}
