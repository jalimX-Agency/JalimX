<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Which clients a role reaches.
 *
 * A role either sees every client (as every role did until now, so nothing
 * changes for existing roles) or only the clients assigned to the person.
 * That one setting follows the client everywhere: its work, invoices,
 * logins, tasks, and the WhatsApp conversations linked to it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            // "all" or "assigned".
            $table->string('client_scope', 16)->default('all')->after('guard_name');
        });

        Schema::create('client_user', function (Blueprint $table) {
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->primary(['client_id', 'user_id']);
        });

        app(PermissionRegistrar::class)->forgetCachedPermissions();
        Permission::findOrCreate('inbox.unlinked', 'web');
        Role::findOrCreate('owner', 'web')->givePermissionTo('inbox.unlinked');
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Schema::dropIfExists('client_user');
        Schema::table('roles', fn (Blueprint $table) => $table->dropColumn('client_scope'));
        Permission::query()->where('name', 'inbox.unlinked')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
