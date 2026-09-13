<?php

namespace App\Console\Commands;

use App\Observers\RevalidatesSite;
use App\Services\SiteRevalidator;
use Illuminate\Console\Command;

/**
 * Force the frontend to drop cached content tags.
 *
 * The observer covers ordinary saves and deletes, but Eloquent fires no model
 * events for mass operations — `Project::where(...)->update(...)` and
 * `->delete()` go straight to the database. Any bulk action in the dashboard
 * will therefore leave the site serving stale content until the hour is up.
 *
 * This is the escape hatch, and the thing to call from any code path that
 * writes in bulk.
 *
 *   php artisan site:revalidate
 *   php artisan site:revalidate projects settings
 */
class RevalidateSite extends Command
{
    protected $signature = 'site:revalidate {tags?* : Defaults to every content tag}';

    protected $description = 'Drop the frontend cache for the given content tags';

    public function handle(SiteRevalidator $revalidator): int
    {
        $known = array_values(RevalidatesSite::TAGS);

        /** @var list<string> $tags */
        $tags = $this->argument('tags') ?: $known;

        $unknown = array_diff($tags, $known);

        if ($unknown !== []) {
            $this->error('Unknown tag(s): '.implode(', ', $unknown));
            $this->line('Known tags: '.implode(', ', $known));

            return self::FAILURE;
        }

        $revalidator->flush($tags);

        $this->info('Revalidated: '.implode(', ', $tags));

        return self::SUCCESS;
    }
}
