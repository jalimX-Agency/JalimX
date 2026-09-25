<?php

use App\Http\Controllers\Api\V1\Admin\AttachmentController;
use App\Http\Controllers\Api\V1\Admin\DocumentPdfController;
use App\Http\Controllers\Api\V1\Admin\InboxController;
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

/*
 * The printable quote or invoice.
 *
 * On the web routes rather than under /api, because the dashboard opens it
 * as a link in a new tab. A top-level navigation carries no Origin header,
 * and Sanctum reads that as a token request with no token - so the same
 * cookie that authenticates every other call would be ignored here. The
 * session is checked in the controller rather than by the auth middleware,
 * which would answer a signed-out visitor with a redirect to a login route
 * that only accepts POST.
 */
Route::get('/documents/{document}/pdf', DocumentPdfController::class)
    ->name('documents.pdf');

/*
 * Downloading a file kept against a piece of work. Here for the same
 * reason as the PDF above: it is followed as a link, and a link carries no
 * Origin header for Sanctum to recognise.
 */
Route::get('/attachments/{attachment}/download', [AttachmentController::class, 'download'])
    ->name('attachments.download');

Route::get('/attachments/{attachment}/preview', [AttachmentController::class, 'preview'])
    ->name('attachments.preview');

/*
 * A file from a WhatsApp conversation — a photo, a voice note, a PDF.
 * Here for the same reason as attachments: an <img> or a link carries no
 * Origin header for Sanctum to recognise.
 */
Route::get('/whatsapp/media/{message}', [InboxController::class, 'media'])
    ->name('whatsapp.media');

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth:sanctum')
    ->name('logout');
