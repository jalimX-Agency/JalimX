<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A piece of work done for a client: the internal side of a project.
 *
 * Deliberately not called "projects" — that table already exists and holds
 * the public case studies. The two are different things that happen to share
 * a word: one is an engagement with money and dates, the other is a page on
 * the marketing site. A finished engagement may point at the case study
 * written about it, which is what case_study_id is for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engagements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('status', 20)->default('planned');
            /*
             * Nullable because a project is often agreed before the number is.
             * Stored in the client's own currency, which is why no currency
             * column lives here.
             */
            $table->decimal('budget', 12, 2)->nullable();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->text('description')->nullable();
            $table->foreignId('case_study_id')->nullable()
                ->constrained('projects')->nullOnDelete();
            $table->timestamps();

            $table->index(['client_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engagements');
    }
};
