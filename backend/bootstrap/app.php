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

        /*
         * The contact form is the one public write, and it must not be held
         * to the dashboard's CSRF check.
         *
         * statefulApi() decides by the request's Origin, not by what the
         * request is: the site and the dashboard share jalimx.com, so a
         * visitor posting the form from www.jalimx.com was treated as a
         * signed-in dashboard session and asked for an XSRF token it had
         * never been given — every enquiry failed with "CSRF token
         * mismatch". CSRF protects what a session is allowed to do; this
         * route needs no session and grants nothing, and it keeps its
         * own defences: validation and a rate limit.
         */
        $middleware->validateCsrfTokens(except: ['api/v1/leads', 'api/v1/whatsapp/webhook']);

        /*
         * Railway (like Heroku, Render, Vercel) terminates TLS at its own edge
         * and forwards plain HTTP to the container, with the original scheme
         * in X-Forwarded-Proto. Without this, Laravel thinks every request is
         * HTTP: url()/secure cookies/CSRF all end up wrong behind the proxy.
         * '*' is standard for a PaaS whose edge IPs aren't fixed or published.
         */
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
