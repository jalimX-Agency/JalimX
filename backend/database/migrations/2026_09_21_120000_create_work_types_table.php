<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The kinds of work JalimX does: a site, social media, SEO, running the
 * booking and review platforms.
 *
 * A table rather than a list in the code, because the agency's offer moves
 * faster than a deployment. The one behaviour a type carries is
 * needs_logins: only work that involves signing in somewhere shows the
 * logins for it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('slug', 80)->unique();
            $table->unsignedSmallInteger('position')->default(0);
            $table->boolean('needs_logins')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('engagement_work_type', function (Blueprint $table) {
            $table->foreignId('engagement_id')->constrained()->cascadeOnDelete();
            $table->foreignId('work_type_id')->constrained()->cascadeOnDelete();
            $table->primary(['engagement_id', 'work_type_id']);
        });

        Schema::table('engagements', function (Blueprint $table) {
            /*
             * one_off: agreed once, with a start and an end, and budget is
             * the whole price. monthly: it runs until someone stops it, and
             * budget is what is charged each month.
             */
            $table->string('billing', 10)->default('one_off')->after('status');
        });

        Schema::table('documents', function (Blueprint $table) {
            /*
             * Which month a recurring invoice covers, as its first day. It
             * is what lets the dashboard say "March is not billed yet"
             * without guessing from dates.
             */
            $table->date('period')->nullable()->after('due_date');
            $table->index(['engagement_id', 'period']);
        });

        $now = now();
        DB::table('work_types')->insert([
            ['name' => 'Website', 'slug' => 'website', 'position' => 1, 'needs_logins' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Social media', 'slug' => 'social-media', 'position' => 2, 'needs_logins' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'SEO', 'slug' => 'seo', 'position' => 3, 'needs_logins' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Platforms', 'slug' => 'platforms', 'position' => 4, 'needs_logins' => true, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex(['engagement_id', 'period']);
            $table->dropColumn('period');
        });
        Schema::table('engagements', fn (Blueprint $table) => $table->dropColumn('billing'));
        Schema::dropIfExists('engagement_work_type');
        Schema::dropIfExists('work_types');
    }
};
