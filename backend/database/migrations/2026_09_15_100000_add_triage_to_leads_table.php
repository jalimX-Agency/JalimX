<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            // Private to the team: what was said on the call, what to send next.
            $table->text('note')->nullable()->after('message');
            // Null until someone opens the lead in the dashboard.
            $table->timestamp('read_at')->nullable()->after('ip');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn(['note', 'read_at']);
        });
    }
};
