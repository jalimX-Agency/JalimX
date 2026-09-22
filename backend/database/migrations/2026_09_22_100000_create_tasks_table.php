<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What has to be done for a piece of work.
 *
 * Deliberately small: a line, maybe a date, done or not. No statuses in
 * between, no assignees, no priorities — this is one person's list, and
 * every field a to-do list asks for is a reason not to write the to-do
 * down. "Done" is a timestamp rather than a flag so the list can say when.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('engagement_id')->constrained()->cascadeOnDelete();
            $table->string('title', 190);
            $table->text('notes')->nullable();
            $table->date('due_on')->nullable();
            $table->timestamp('done_at')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();

            // The two questions asked of this table: what is left on this
            // work, and what is due soon across all of it.
            $table->index(['engagement_id', 'done_at']);
            $table->index(['done_at', 'due_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
