<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * WhatsApp reminders for a task.
 *
 * A task can carry several: "a day before" and "15 minutes before" are
 * both reasonable for the same task, so this is its own table rather
 * than a single offset on the task. Counted against due_on plus the new
 * due_time — a task with no time set is treated as due at a fixed hour
 * (see Task::dueAt), so "15 minutes before" still means something.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->time('due_time')->nullable()->after('due_on');
        });

        Schema::create('task_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            // Minutes before the task is due; 0 means "at the due time".
            $table->unsignedInteger('offset_minutes');
            $table->timestamp('sent_at')->nullable();
            // Given up after enough failures — a broken template or a
            // revoked token should not be retried forever.
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('last_error', 500)->nullable();
            $table->timestamps();

            // What the scheduler reads every minute: everything not sent.
            $table->index(['sent_at', 'task_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_reminders');

        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('due_time');
        });
    }
};
