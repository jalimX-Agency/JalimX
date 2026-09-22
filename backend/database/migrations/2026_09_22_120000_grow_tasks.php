<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tasks grow up: they stand on their own.
 *
 * A task no longer has to belong to a piece of work. It can belong to a
 * client only ("call them about the photos"), or to nobody ("read today's
 * email"). It gains a status between to-do and done, a progress figure, a
 * priority, a checklist, and a repeat so the daily and weekly chores
 * write themselves.
 *
 * done_at stays the source of truth for "finished" and when; status only
 * adds the steps in between, and the two are kept in step on every save.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->foreignId('engagement_id')->nullable()->change();
            $table->foreignId('client_id')->nullable()->after('engagement_id')
                ->constrained()->cascadeOnDelete();
            // todo | doing | waiting | done
            $table->string('status', 16)->default('todo')->after('title');
            // low | normal | high
            $table->string('priority', 8)->default('normal')->after('status');
            $table->unsignedTinyInteger('progress')->default(0)->after('priority');
            // [{ "text": "...", "done": bool }]
            $table->json('checklist')->nullable()->after('notes');
            // daily | weekdays | weekly | monthly — null for a one-off.
            $table->string('repeat', 16)->nullable()->after('due_on');

            $table->index(['client_id', 'done_at']);
            $table->index('status');
        });

        // Tasks that already exist belong to a work; give them its client
        // and a status that matches their tick.
        DB::statement('update tasks set client_id = (select client_id from engagements where engagements.id = tasks.engagement_id) where engagement_id is not null');
        DB::table('tasks')->whereNotNull('done_at')->update(['status' => 'done', 'progress' => 100]);
    }

    public function down(): void
    {
        DB::table('tasks')->whereNull('engagement_id')->delete();

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropIndex(['client_id', 'done_at']);
            $table->dropIndex(['status']);
            $table->dropConstrainedForeignId('client_id');
            $table->dropColumn(['status', 'priority', 'progress', 'checklist', 'repeat']);
            $table->foreignId('engagement_id')->nullable(false)->change();
        });
    }
};
