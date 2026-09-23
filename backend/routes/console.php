<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Checked every minute so "15 minutes before" actually means 15 minutes.
// Needs something on the host actually running `php artisan schedule:run`
// each minute — Railway does not do this on its own; see docs/SETUP.md.
Schedule::command('tasks:send-reminders')->everyMinute()->withoutOverlapping();
