<?php

use App\Http\Controllers\Api\V1\Admin\AttachmentController;
use App\Http\Controllers\Api\V1\Admin\BillingProfileController;
use App\Http\Controllers\Api\V1\Admin\ClientController as AdminClientController;
use App\Http\Controllers\Api\V1\Admin\CredentialController;
use App\Http\Controllers\Api\V1\Admin\DocumentController;
use App\Http\Controllers\Api\V1\Admin\EngagementController as AdminEngagementController;
use App\Http\Controllers\Api\V1\Admin\LeadController as AdminLeadController;
use App\Http\Controllers\Api\V1\Admin\PaymentController;
use App\Http\Controllers\Api\V1\Admin\ProjectContentController;
use App\Http\Controllers\Api\V1\Admin\ProjectMediaController;
use App\Http\Controllers\Api\V1\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\V1\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\V1\Admin\WorkTypeController;
use App\Http\Controllers\Api\V1\LeadController;
use App\Http\Controllers\Api\V1\ProjectController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\TestimonialController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API v1
|--------------------------------------------------------------------------
|
| Versioned from day one. The frontend's generated types are bound to this
| prefix, so a breaking change becomes /v2 rather than a silent edit here.
|
*/

Route::prefix('v1')->group(function () {

    Route::get('/health', fn () => response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'env' => config('app.env'),
        'database' => config('database.default'),
        'time' => now()->toIso8601String(),
    ]));

    /*
     * Public reads. These feed the marketing site, which caches them with ISR,
     * so the traffic here is a trickle of revalidations rather than per-visitor.
     */
    Route::get('/services', [ServiceController::class, 'index']);
    Route::get('/services/{service}', [ServiceController::class, 'show']);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);

    Route::get('/testimonials', [TestimonialController::class, 'index']);
    Route::get('/settings', [SettingController::class, 'index']);

    /*
     * The one public write, and a spam target.
     *
     * The throttle counts every request, including the ones that fail
     * validation - so it has to leave room for a real person mistyping their
     * email two or three times and resubmitting. Six was tight enough to lock
     * out someone simply fumbling the form; twelve still stops anything worth
     * calling abuse.
     */
    Route::post('/leads', [LeadController::class, 'store'])
        ->middleware('throttle:12,60');

    Route::middleware('auth:sanctum')->group(function () {
        /*
         * The dashboard. Everything under /admin can see unpublished work, so
         * nothing here is reachable without the session.
         */
        Route::prefix('admin')->group(function () {
            Route::get('/projects', [ProjectMediaController::class, 'index']);
            Route::post('/projects', [ProjectContentController::class, 'store']);
            Route::put('/projects/{project}', [ProjectContentController::class, 'update']);
            Route::get('/projects/{project}', [ProjectMediaController::class, 'show']);
            Route::post('/projects/{project}/media', [ProjectMediaController::class, 'store'])
                ->middleware('throttle:60,1');
            Route::delete('/media/{media}', [ProjectMediaController::class, 'destroy']);

            Route::get('/services', [AdminServiceController::class, 'index']);
            Route::put('/services/{service}', [AdminServiceController::class, 'update']);

            Route::get('/settings', [AdminSettingController::class, 'show']);
            Route::put('/settings', [AdminSettingController::class, 'update']);

            Route::get('/clients', [AdminClientController::class, 'index']);
            Route::post('/clients', [AdminClientController::class, 'store']);
            Route::get('/clients/{client}', [AdminClientController::class, 'show']);
            Route::put('/clients/{client}', [AdminClientController::class, 'update']);
            Route::delete('/clients/{client}', [AdminClientController::class, 'destroy']);
            Route::post('/leads/{lead}/convert', [AdminClientController::class, 'convertLead']);

            /*
             * Work for a client. Created under the client it belongs to, then
             * edited by its own id — there is no list of all engagements,
             * because the client page is the only place they are read.
             */
            Route::post('/clients/{client}/engagements', [AdminEngagementController::class, 'store']);
            Route::put('/engagements/{engagement}', [AdminEngagementController::class, 'update']);
            Route::delete('/engagements/{engagement}', [AdminEngagementController::class, 'destroy']);
            /*
             * A case study is started from the work it is about, so it
             * arrives knowing the client, the name and the year.
             */
            Route::post('/engagements/{engagement}/case-study', [AdminEngagementController::class, 'createCaseStudy']);

            Route::post('/engagements/{engagement}/attachments', [AttachmentController::class, 'store'])
                ->middleware('throttle:60,1');
            Route::delete('/attachments/{attachment}', [AttachmentController::class, 'destroy']);

            /*
             * Logins. The secret is handed over one at a time by reveal,
             * never in a list.
             */
            Route::post('/clients/{client}/credentials', [CredentialController::class, 'store']);
            Route::put('/credentials/{credential}', [CredentialController::class, 'update']);
            Route::get('/credentials/{credential}/reveal', [CredentialController::class, 'reveal']);
            Route::delete('/credentials/{credential}', [CredentialController::class, 'destroy']);

            Route::get('/work-types', [WorkTypeController::class, 'index']);
            Route::post('/work-types', [WorkTypeController::class, 'store']);
            Route::put('/work-types/{workType}', [WorkTypeController::class, 'update']);
            Route::delete('/work-types/{workType}', [WorkTypeController::class, 'destroy']);

            /*
             * Quotes and invoices. Written under a client, then worked on by
             * their own id. Issued ones are not editable and not deletable -
             * only paid, accepted, declined or cancelled.
             */
            Route::post('/clients/{client}/documents', [DocumentController::class, 'store']);
            Route::put('/documents/{document}', [DocumentController::class, 'update']);
            Route::post('/documents/{document}/issue', [DocumentController::class, 'issue']);
            Route::post('/documents/{document}/status', [DocumentController::class, 'status']);
            Route::delete('/documents/{document}', [DocumentController::class, 'destroy']);

            Route::post('/documents/{document}/payments', [PaymentController::class, 'store']);
            Route::delete('/payments/{payment}', [PaymentController::class, 'destroy']);

            Route::get('/billing-profile', [BillingProfileController::class, 'show']);
            Route::put('/billing-profile', [BillingProfileController::class, 'update']);

            Route::get('/leads', [AdminLeadController::class, 'index']);
            Route::get('/leads/{lead}', [AdminLeadController::class, 'show']);
            Route::patch('/leads/{lead}', [AdminLeadController::class, 'update']);
            Route::delete('/leads/{lead}', [AdminLeadController::class, 'destroy']);
        });

        Route::get('/auth/me', function (Request $request) {
            $user = $request->user();

            return response()->json([
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'roles' => $user->getRoleNames(),
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                ],
            ]);
        });
    });
});
