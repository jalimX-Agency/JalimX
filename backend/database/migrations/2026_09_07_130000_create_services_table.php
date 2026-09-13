<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('is_published')->default(false);

            // Translatable (spatie/laravel-translatable) - {"en": "...", "fr": "..."}
            $table->json('title');
            $table->json('tagline')->nullable();
            $table->json('body')->nullable();

            // Key into the frontend's icon map, not raw markup - keeps untrusted
            // SVG out of the database and out of the page.
            $table->string('icon')->nullable();

            $table->timestamps();

            $table->index(['is_published', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
