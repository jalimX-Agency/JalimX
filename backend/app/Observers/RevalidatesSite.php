<?php

namespace App\Observers;

use App\Services\SiteRevalidator;
use Illuminate\Database\Eloquent\Model;

/**
 * Flushes the frontend cache tag matching whichever model just changed.
 *
 * Bound in AppServiceProvider rather than attached per-model so there is one
 * place to look when a new content type needs the same behaviour.
 *
 * ⚠️ Covers saves and deletes on a model *instance* only. Eloquent fires no
 * events for mass operations - `Project::where(...)->update()` and `->delete()`
 * go straight to the database - so a bulk action in the dashboard leaves the
 * site serving stale content until the revalidate window expires.
 *
 * Any code path that writes in bulk must call SiteRevalidator itself, or run
 * `php artisan site:revalidate`.
 */
class RevalidatesSite
{
    /** @var array<class-string, string> */
    public const TAGS = [
        \App\Models\Service::class => 'services',
        \App\Models\Project::class => 'projects',
        \App\Models\Testimonial::class => 'testimonials',
        \App\Models\Setting::class => 'settings',
    ];

    public function __construct(private readonly SiteRevalidator $revalidator) {}

    public function saved(Model $model): void
    {
        $this->flush($model);
    }

    public function deleted(Model $model): void
    {
        $this->flush($model);
    }

    private function flush(Model $model): void
    {
        $tag = self::TAGS[$model::class] ?? null;

        if ($tag === null) {
            return;
        }

        $tags = [$tag];

        // A testimonial is rendered inside its case study, so the project pages
        // are stale too.
        if ($tag === 'testimonials') {
            $tags[] = 'projects';
        }

        /*
         * In a web request this is a dashboard save, so the round trip to the
         * frontend is deferred until after the response — no reason to make the
         * editor wait on it.
         *
         * In the console there is no response to defer past: `afterResponse`
         * callbacks are dropped when the process exits, which would silently
         * skip revalidation for every seeder, import and artisan command. So
         * console runs flush inline.
         */
        if (app()->runningInConsole()) {
            $this->revalidator->flush($tags);

            return;
        }

        dispatch(fn () => app(SiteRevalidator::class)->flush($tags))
            ->afterResponse();
    }
}
