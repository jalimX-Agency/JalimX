<?php

/*
 * How the AI credential pool behaves. The keys themselves are not here — they
 * live encrypted in the database and are managed from the dashboard.
 */
return [
    // Seconds to wait for a provider before treating it as down.
    'timeout' => (int) env('AI_TIMEOUT', 30),

    // Most credentials one request may try before giving up.
    'max_attempts' => (int) env('AI_MAX_ATTEMPTS', 5),

    /*
     * How long a rate-limited key rests when the provider does not say.
     * Each rate limit in a row moves one step along; a success resets it.
     */
    'cooldown_steps' => [60, 300, 1800, 21600],

    // A provider that told us how long to wait is believed, within reason.
    'cooldown_min' => 10,
    'cooldown_max' => 86400,

    // A key whose quota is "per day" rests this long when no reset is given.
    'daily_cooldown' => 21600,

    // A provider that answered with a 5xx or not at all.
    'outage_cooldown' => 120,
];
