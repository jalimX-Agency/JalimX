<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
         * Lets the API routes read the dashboard's session cookie.
         *
         * Without it, `auth:sanctum` only ever looks for a bearer token, so a
         * request that had just logged in successfully still came back 401 —
         * the session existed, nothing on the API side was willing to look at
         * it. Sanctum only trusts the cookie for origins listed in
         * SANCTUM_STATEFUL_DOMAINS; everything else stays token-only.
         */
        $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
