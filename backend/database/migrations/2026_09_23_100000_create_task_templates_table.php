<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Task templates: the list of steps a kind of job always takes, written
 * once and dropped onto a new piece of work in one click.
 *
 * The steps are a JSON list on the template rather than a table of their
 * own: they are only ever read and written together, as the template, and
 * copied into real tasks when it is used. Changing a template later does
 * not touch tasks already made from it.
 *
 * Each step's "day" counts from the start date chosen when the template is
 * used, so "day 7" means a week after the job starts. No day means no due
 * date.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('description', 500)->nullable();
            // Suggested first for work of this kind.
            $table->foreignId('work_type_id')->nullable()->constrained()->nullOnDelete();
            // [{ "title", "day": int|null, "priority", "checklist": [string] }]
            $table->json('items');
            $table->unsignedInteger('position')->default(0);
            $table->timestamps();
        });

        $this->seedStarters();
    }

    public function down(): void
    {
        Schema::dropIfExists('task_templates');
    }

    /**
     * A first set to edit rather than an empty page: the steps the agency
     * takes on each kind of job it already offers. Every one can be
     * changed or deleted in settings.
     */
    private function seedStarters(): void
    {
        $type = fn (string $slug) => DB::table('work_types')->where('slug', $slug)->value('id');
        $step = fn (string $title, ?int $day, string $priority = 'normal', array $checklist = []) => compact('title', 'day', 'priority', 'checklist');

        $starters = [
            [
                'name' => 'New website',
                'description' => 'From the first call to the handover, about a month.',
                'work_type_id' => $type('website'),
                'items' => [
                    $step('Kick-off call: goals, pages, references', 0, 'high', ['List of pages', 'Logo and brand colours', 'Sites they like', 'Deadline agreed']),
                    $step('Collect the content', 2, 'normal', ['Texts', 'Photos', 'Domain and hosting access']),
                    $step('Set up domain and hosting', 3),
                    $step('Send the design for approval', 7, 'high'),
                    $step('Client feedback on the design', 10),
                    $step('Build the pages', 17),
                    $step('SEO basics', 21, 'normal', ['Titles and descriptions', 'Sitemap', 'Google Search Console']),
                    $step('Test on phone, tablet and desktop', 23, 'normal', ['Forms send', 'Links work', 'Speed check', 'Mobile layout']),
                    $step('Client review and corrections', 25),
                    $step('Go live', 28, 'high', ['DNS pointed', 'SSL active', 'Analytics installed', 'Backup taken']),
                    $step('Hand over the logins and a short training', 30),
                ],
            ],
            [
                'name' => 'Social media — one month',
                'description' => 'Use at the start of each month of a social media retainer.',
                'work_type_id' => $type('social-media'),
                'items' => [
                    $step('Content calendar for the month', 0, 'high'),
                    $step('Shoot or collect photos and videos', 2),
                    $step('Calendar approved by the client', 4),
                    $step('Schedule the first half of the month', 5),
                    $step('Schedule the second half of the month', 15),
                    $step('Monthly report', 28, 'normal', ['Reach', 'New followers', 'Best posts', 'Plan for next month']),
                ],
            ],
            [
                'name' => 'Platforms set-up',
                'description' => 'Booking, TripAdvisor, Google Business and the like.',
                'work_type_id' => $type('platforms'),
                'items' => [
                    $step('Get access to their accounts', 0, 'high', ['Booking.com', 'TripAdvisor', 'Google Business Profile']),
                    $step('Update photos and descriptions', 2),
                    $step('Check prices, availability and policies', 3),
                    $step('Reply to recent reviews', 5),
                    $step('Set up a routine for replying to reviews', 7),
                ],
            ],
            [
                'name' => 'SEO — first month',
                'description' => null,
                'work_type_id' => $type('seo'),
                'items' => [
                    $step('Technical audit', 0, 'normal', ['Speed', 'Indexing', 'Errors and broken links']),
                    $step('Keyword research', 3),
                    $step('Fix on-page issues', 7),
                    $step('Optimise the Google Business Profile', 10),
                    $step('Monthly ranking report', 30),
                ],
            ],
        ];

        $now = now();
        foreach ($starters as $i => $t) {
            DB::table('task_templates')->insert([
                ...$t,
                'items' => json_encode($t['items']),
                'position' => $i + 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
};
