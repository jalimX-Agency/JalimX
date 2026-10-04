<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * The first permissions the dashboard checks.
 *
 * Until now every signed-in account could do everything, which is fine for
 * one person and wrong the day there is a second one. AI keys are where that
 * starts: `ai.use` is the writing help in every form, `ai.manage` is adding,
 * rotating and removing the keys themselves.
 *
 * Every account that exists today is the owner, so each one gets the `owner`
 * role and nothing that worked before stops working.
 */
return new class extends Migration
{
    private const PERMISSIONS = ['ai.use', 'ai.manage'];

    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $owner = Role::findOrCreate('owner', 'web');
        $owner->givePermissionTo(self::PERMISSIONS);

        User::query()->each(fn (User $user) => $user->assignRole($owner));

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        Permission::query()->whereIn('name', self::PERMISSIONS)->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
