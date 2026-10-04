<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a kind of work covers, in a sentence or two.
 *
 * "SEO" means something specific at this agency; the writing help reads this
 * description when that kind is chosen on a form, so what it writes matches
 * what is actually sold rather than a generic idea of the word.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_types', function (Blueprint $table) {
            $table->text('description')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('work_types', fn (Blueprint $table) => $table->dropColumn('description'));
    }
};
