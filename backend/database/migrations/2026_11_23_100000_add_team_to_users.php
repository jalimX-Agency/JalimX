<?php

use App\Models\User;
use App\Support\Permissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * A team instead of one account.
 *
 * Users can now be invited (a one-time link, valid a week) and switched off
 * without deleting them, so what they did keeps its name. Every permission
 * the dashboard checks is created here; the owner role holds all of them,
 * and every account that exists today stays the owner it already was.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Off: cannot sign in, and every session is refused. Kept, not deleted.
            $table->boolean('is_active')->default(true)->after('password');
            // A sha256 of the invite link's token; the token itself is never stored.
            $table->string('invite_token', 64)->nullable()->unique()->after('is_active');
            $table->timestamp('invite_expires_at')->nullable()->after('invite_token');
            $table->timestamp('invite_accepted_at')->nullable()->after('invite_expires_at');
            $table->foreignId('invited_by')->nullable()->after('invite_accepted_at')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('last_login_at')->nullable()->after('invited_by');
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (Permissions::all() as $name) {
            Permission::findOrCreate($name, 'web');
        }

        $owner = Role::findOrCreate(Permissions::OWNER_ROLE, 'web');
        $owner->syncPermissions(Permissions::all());

        // Accounts made before invites existed signed in already; they are not pending.
        User::query()->whereNull('invite_accepted_at')->update(['invite_accepted_at' => now()]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invited_by');
            $table->dropColumn(['is_active', 'invite_token', 'invite_expires_at', 'invite_accepted_at', 'last_login_at']);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Permission::query()->whereIn('name', array_diff(Permissions::all(), ['ai.use', 'ai.manage']))->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
