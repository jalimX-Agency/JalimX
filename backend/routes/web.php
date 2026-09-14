<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

/*
 * Dashboard session auth.
 *
 * On the web routes, not under /api: Sanctum's SPA mode authenticates with the
 * ordinary session cookie, and only this middleware group starts a session.
 * The cookie is httpOnly, so a script running on the page cannot read it the
 * way it could read a token kept in localStorage.
 *
 * The throttle here is a blunt ceiling on the route; AuthController applies the
 * real one, keyed per email and address.
 */
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:20,1')
    ->name('login');

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth:sanctum')
    ->name('logout');
