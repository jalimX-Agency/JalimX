<?php

namespace App\Providers;

use App\Observers\RevalidatesSite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Any content change drops the matching cache tag on the frontend.
        foreach (RevalidatesSite::TAGS as $model => $tag) {
            $model::observe(RevalidatesSite::class);
        }
    }
}
