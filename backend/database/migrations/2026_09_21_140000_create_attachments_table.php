<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paperwork kept against a piece of work: the signed contract, the brief,
 * a screenshot, whatever arrived by email and would otherwise live in a
 * mailbox nobody can search in two years.
 *
 * Not spatie/medialibrary, which is set up here for the site's images and
 * their public URLs. These files are the opposite: they are private, they
 * are not images, and they are only ever handed out by the app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('engagement_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 20)->default('other');
            // What it was called on the way in, shown in the list and used
            // for the download. The stored path is random and unrelated.
            $table->string('name', 190);
            $table->string('path', 255);
            $table->string('disk', 20)->default('files');
            $table->string('mime', 120)->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();

            $table->index(['engagement_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
