<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS)
    |--------------------------------------------------------------------------
    |
    | The frontend talks to this API with cookies (Sanctum), so credentials must
    | be allowed and each origin listed explicitly - browsers reject a wildcard
    | origin whenever credentials are in play.
    |
    */

    // invite/accept: a team invite sets the password and signs in, like login.
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'login', 'logout', 'invite/accept'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(
        array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:3200')))
    ),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
