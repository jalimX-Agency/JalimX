<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The logins a client's work needs: their hosting, their CMS, the booking
 * platform, the social accounts.
 *
 * Held on the client rather than on one piece of work, because the hosting
 * for a riad is the same hosting whether this month's job is a rebuild or
 * a maintenance retainer. A login may point at the work it belongs to,
 * and most do.
 *
 * The secret and the notes are encrypted with the application key, so a
 * copy of the database on its own reveals nothing. That also means the key
 * is now as valuable as the passwords: it belongs in the host's
 * environment and nowhere else.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('engagement_id')->nullable()->constrained()->nullOnDelete();
            $table->string('label', 120);
            $table->string('url', 190)->nullable();
            $table->string('username', 190)->nullable();
            // text, not string: ciphertext is several times longer than
            // what went into it.
            $table->text('secret')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('client_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credentials');
    }
};
