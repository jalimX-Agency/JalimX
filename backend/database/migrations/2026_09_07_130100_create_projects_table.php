<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Public case studies. Distinct from the internal `engagements` table that
     * arrives in phase 2: not every job gets published, and no case study
     * should carry billing data.
     */
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_published')->default(false);
            $table->boolean('is_featured')->default(false);

            $table->string('client_name');
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('project_url')->nullable();

            $table->json('title');
            $table->json('summary')->nullable();
            $table->json('challenge')->nullable();
            $table->json('solution')->nullable();
            $table->json('outcome')->nullable();

            $table->json('tags')->nullable();     // ["web", "booking"]
            $table->json('stack')->nullable();    // ["Next.js", "Laravel"]

            // [{"label": {"en": "...", "fr": "..."}, "value": "+38%"}]
            // Numbers sell a case study - but only real ones go in here.
            $table->json('metrics')->nullable();

            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['is_published', 'is_featured', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
