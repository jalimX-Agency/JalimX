<?php

use App\Http\Controllers\Api\V1\Admin\AiAssistController;
use App\Http\Controllers\Api\V1\Admin\AiCredentialController;
use App\Http\Controllers\Api\V1\Admin\AttachmentController;
use App\Http\Controllers\Api\V1\Admin\BillingProfileController;
use App\Http\Controllers\Api\V1\Admin\ClientController as AdminClientController;
use App\Http\Controllers\Api\V1\Admin\CredentialController;
use App\Http\Controllers\Api\V1\Admin\CredentialSheetController;
use App\Http\Controllers\Api\V1\Admin\DocumentController;
use App\Http\Controllers\Api\V1\Admin\DocumentWhatsAppController;
use App\Http\Controllers\Api\V1\Admin\EngagementController as AdminEngagementController;
use App\Http\Controllers\Api\V1\Admin\InboxController;
use App\Http\Controllers\Api\V1\Admin\LeadController as AdminLeadController;
use App\Http\Controllers\Api\V1\Admin\LeadReplyController;
use App\Http\Controllers\Api\V1\Admin\LeadReplyTemplateController;
use App\Http\Controllers\Api\V1\Admin\RoleController;
use App\Http\Controllers\Api\V1\Admin\TeamController;
use App\Http\Controllers\InviteController;
use App\Http\Controllers\Api\V1\Admin\OverviewController;
use App\Http\Controllers\Api\V1\Admin\PaymentController;
use App\Http\Controllers\Api\V1\Admin\PaymentWhatsAppController;
use App\Http\Controllers\Api\V1\Admin\ProjectContentController;
use App\Http\Controllers\Api\V1\Admin\ProjectMediaController;
use App\Http\Controllers\Api\V1\Admin\ServiceController as AdminServiceController;
use App\Http\Controllers\Api\V1\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\V1\Admin\TaskController;
use App\Http\Controllers\Api\V1\Admin\TaskTemplateController;
use App\Http\Controllers\Api\V1\Admin\TestimonialController as AdminTestimonialController;
use App\Http\Controllers\Api\V1\Admin\WhatsAppController;
use App\Http\Controllers\Api\V1\Admin\WorkTypeController;
use App\Http\Controllers\Api\V1\LeadController;
use App\Http\Controllers\Api\V1\ProjectController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\SettingController;
use App\Http\Controllers\Api\V1\TestimonialController;
use App\Http\Controllers\Api\V1\WhatsAppWebhookController;
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
    Route::middleware('site.key')->group(function () {
        Route::get('/services', [ServiceController::class, 'index']);
        Route::get('/services/{service}', [ServiceController::class, 'show']);

        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);

        Route::get('/testimonials', [TestimonialController::class, 'index']);
        Route::get('/settings', [SettingController::class, 'index']);
    });

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

    /*
     * Meta's webhook for the agency's WhatsApp number: the one-time check
     * that the URL is ours, then every message and receipt. Public, and
     * trusted only once the signature on the body checks out.
     */
    Route::get('/whatsapp/webhook', [WhatsAppWebhookController::class, 'verify']);
    Route::post('/whatsapp/webhook', [WhatsAppWebhookController::class, 'receive'])
        ->middleware('throttle:600,1');

    Route::get('/invites/{token}', [InviteController::class, 'show'])->middleware('throttle:20,1');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        /*
         * The dashboard. Everything under /admin can see unpublished work, so
         * nothing here is reachable without the session.
         */
        Route::prefix('admin')->group(function () {
            // The team: who can sign in, and what each role may do.
            Route::middleware('can:team.manage')->group(function () {
                Route::get('/team', [TeamController::class, 'index']);
                Route::post('/team/invites', [TeamController::class, 'invite'])->middleware('throttle:20,1');
                Route::post('/team/{user}/invite', [TeamController::class, 'resend'])->middleware('throttle:20,1');
                Route::patch('/team/{user}', [TeamController::class, 'update']);
                Route::delete('/team/{user}', [TeamController::class, 'destroy']);
                Route::post('/roles', [RoleController::class, 'store']);
                Route::put('/roles/{role}', [RoleController::class, 'update']);
                Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
            });

            // The first screen, in one request.
            Route::get('/overview', OverviewController::class);

            Route::get('/projects', [ProjectMediaController::class, 'index'])
                ->middleware('can:site.manage');
            Route::post('/projects', [ProjectContentController::class, 'store'])
                ->middleware('can:site.manage');
            Route::put('/projects/{project}', [ProjectContentController::class, 'update'])
                ->middleware('can:site.manage');
            Route::get('/projects/{project}', [ProjectMediaController::class, 'show'])
                ->middleware('can:site.manage');
            Route::post('/projects/{project}/media', [ProjectMediaController::class, 'store'])
                ->middleware('throttle:60,1')
                ->middleware('can:site.manage');
            Route::delete('/projects/{project}', [ProjectContentController::class, 'destroy'])
                ->middleware('can:site.manage');
            Route::post('/projects-order', [ProjectContentController::class, 'reorder'])
                ->middleware('can:site.manage');
            Route::post('/projects/{project}/media-order', [ProjectMediaController::class, 'reorder'])
                ->middleware('can:site.manage');
            Route::patch('/media/{media}', [ProjectMediaController::class, 'update'])
                ->middleware('can:site.manage');
            Route::delete('/media/{media}', [ProjectMediaController::class, 'destroy'])
                ->middleware('can:site.manage');

            Route::get('/testimonials', [AdminTestimonialController::class, 'index'])
                ->middleware('can:site.manage');
            Route::post('/testimonials', [AdminTestimonialController::class, 'store'])
                ->middleware('can:site.manage');
            Route::put('/testimonials/{testimonial}', [AdminTestimonialController::class, 'update'])
                ->middleware('can:site.manage');
            Route::delete('/testimonials/{testimonial}', [AdminTestimonialController::class, 'destroy'])
                ->middleware('can:site.manage');

            /*
             * AI. The keys are managed only by an account allowed to
             * (`ai.manage`); the writing help is for anyone with `ai.use`.
             * Neither ever returns a key.
             */
            Route::middleware('can:ai.manage')->prefix('ai')->group(function () {
                Route::get('/providers', [AiCredentialController::class, 'providers']);
                Route::get('/credentials', [AiCredentialController::class, 'index']);
                Route::post('/credentials', [AiCredentialController::class, 'store'])->middleware('throttle:20,1');
                Route::put('/credentials/{credential}', [AiCredentialController::class, 'update'])->middleware('throttle:20,1');
                Route::delete('/credentials/{credential}', [AiCredentialController::class, 'destroy']);
                Route::post('/credentials/{credential}/test', [AiCredentialController::class, 'test'])->middleware('throttle:20,1');
                Route::post('/credentials/{credential}/state', [AiCredentialController::class, 'state'])->middleware('throttle:20,1');
                Route::post('/credentials-order', [AiCredentialController::class, 'reorder']);
                Route::post('/test', [AiCredentialController::class, 'testDraft'])->middleware('throttle:20,1');
            });
            Route::post('/ai/assist', AiAssistController::class)->middleware(['can:ai.use', 'throttle:40,1']);

            Route::get('/services', [AdminServiceController::class, 'index'])
                ->middleware('can:site.manage');
            Route::put('/services/{service}', [AdminServiceController::class, 'update'])
                ->middleware('can:site.manage');

            Route::get('/settings', [AdminSettingController::class, 'show'])
                ->middleware('can:site.manage');
            Route::put('/settings', [AdminSettingController::class, 'update'])
                ->middleware('can:site.manage');

            Route::get('/clients', [AdminClientController::class, 'index'])
                ->middleware('can:clients.view');
            Route::post('/clients', [AdminClientController::class, 'store'])
                ->middleware('can:clients.manage');
            Route::get('/clients/{client}', [AdminClientController::class, 'show'])
                ->middleware('can:clients.view');
            Route::put('/clients/{client}', [AdminClientController::class, 'update'])
                ->middleware('can:clients.manage');
            Route::delete('/clients/{client}', [AdminClientController::class, 'destroy'])
                ->middleware('can:clients.manage');
            Route::post('/leads/{lead}/convert', [AdminClientController::class, 'convertLead'])
                ->middleware('can:leads.manage');

            /*
             * Work for a client. Created under the client it belongs to, then
             * edited by its own id — there is no list of all engagements,
             * because the client page is the only place they are read.
             */
            Route::post('/clients/{client}/engagements', [AdminEngagementController::class, 'store'])
                ->middleware('can:clients.manage');
            Route::put('/engagements/{engagement}', [AdminEngagementController::class, 'update'])
                ->middleware('can:clients.manage');
            Route::delete('/engagements/{engagement}', [AdminEngagementController::class, 'destroy'])
                ->middleware('can:clients.manage');
            /*
             * A case study is started from the work it is about, so it
             * arrives knowing the client, the name and the year.
             */
            Route::post('/engagements/{engagement}/case-study', [AdminEngagementController::class, 'createCaseStudy'])
                ->middleware('can:clients.manage');

            Route::post('/engagements/{engagement}/attachments', [AttachmentController::class, 'store'])
                ->middleware('throttle:60,1')
                ->middleware('can:clients.manage');
            Route::delete('/attachments/{attachment}', [AttachmentController::class, 'destroy'])
                ->middleware('can:clients.manage');

            /*
             * Tasks: inside a piece of work, under a client, or on their own.
             * Each change saves alone.
             */
            Route::get('/tasks', [TaskController::class, 'index'])
                ->middleware('can:tasks.view');
            Route::post('/tasks', [TaskController::class, 'store'])
                ->middleware('can:tasks.manage');
            Route::post('/engagements/{engagement}/tasks', [TaskController::class, 'storeForEngagement'])
                ->middleware('can:tasks.manage');

            // The steps a kind of job always takes, written once.
            Route::get('/task-templates', [TaskTemplateController::class, 'index'])
                ->middleware('can:tasks.view');
            Route::post('/task-templates', [TaskTemplateController::class, 'store'])
                ->middleware('can:settings.manage');
            Route::put('/task-templates/{taskTemplate}', [TaskTemplateController::class, 'update'])
                ->middleware('can:settings.manage');
            Route::delete('/task-templates/{taskTemplate}', [TaskTemplateController::class, 'destroy'])
                ->middleware('can:settings.manage');
            Route::post('/task-templates/{taskTemplate}/apply', [TaskTemplateController::class, 'apply'])
                ->middleware('can:tasks.manage');
            Route::post('/engagements/{engagement}/task-template', [TaskTemplateController::class, 'fromEngagement'])
                ->middleware('can:settings.manage');
            // The same change to a whole selection, in one request.
            Route::post('/tasks/bulk', [TaskController::class, 'bulk'])
                ->middleware('can:tasks.manage');

            /*
             * WhatsApp reminders: the number they go to and the wording of
             * the templates. The test send is throttled — it costs a message.
             */
            /*
             * The inbox: conversations on the WhatsApp number, read and
             * answered here. Replies are throttled — each one is a message.
             */
            Route::get('/inbox', [InboxController::class, 'index'])
                ->middleware('can:inbox.view');
            Route::get('/inbox/pulse', [InboxController::class, 'pulse'])
                ->middleware('can:inbox.view');
            Route::get('/inbox/{contact}', [InboxController::class, 'show'])
                ->middleware('can:inbox.view');
            Route::post('/inbox/{contact}/reply', [InboxController::class, 'reply'])
                ->middleware('throttle:30,1')
                ->middleware('can:inbox.reply');
            Route::put('/inbox/{contact}/client', [InboxController::class, 'link'])
                ->middleware('can:inbox.reply');

            Route::get('/whatsapp', [WhatsAppController::class, 'show'])
                ->middleware('can:settings.manage');
            Route::put('/whatsapp/recipient', [WhatsAppController::class, 'updateRecipient'])
                ->middleware('can:settings.manage');
            Route::put('/whatsapp/templates/{key}', [WhatsAppController::class, 'updateTemplate'])
                ->whereIn('key', ['basic', 'notes', 'steps', 'full', 'invoice', 'payment', 'logins', 'logins_open'])
                ->middleware('can:settings.manage');
            Route::post('/whatsapp/templates/create-missing', [WhatsAppController::class, 'createMissing'])
                ->middleware('can:settings.manage');
            Route::post('/whatsapp/test', [WhatsAppController::class, 'test'])->middleware('throttle:5,1')
                ->middleware('can:settings.manage');
            Route::patch('/tasks/{task}', [TaskController::class, 'update'])
                ->middleware('can:tasks.manage');
            Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])
                ->middleware('can:tasks.manage');

            /*
             * Logins. The secret is handed over one at a time by reveal,
             * never in a list.
             */
            Route::post('/clients/{client}/credentials', [CredentialController::class, 'store'])
                ->middleware('can:logins.manage');
            Route::put('/credentials/{credential}', [CredentialController::class, 'update'])
                ->middleware('can:logins.manage');
            Route::get('/credentials/{credential}/reveal', [CredentialController::class, 'reveal'])
                ->middleware('can:logins.reveal');
            Route::delete('/credentials/{credential}', [CredentialController::class, 'destroy'])
                ->middleware('can:logins.manage');

            // Handing logins over: as a PDF here, or by email or WhatsApp to
            // the client. Throttled because each one decrypts every password
            // selected.
            Route::post('/clients/{client}/credentials/sheet', [CredentialSheetController::class, 'download'])
                ->middleware('throttle:20,1')
                ->middleware('can:logins.reveal');
            Route::post('/clients/{client}/credentials/send', [CredentialSheetController::class, 'send'])
                ->middleware('throttle:10,1')
                ->middleware('can:logins.reveal');
            Route::post('/clients/{client}/credentials/whatsapp', [CredentialSheetController::class, 'whatsapp'])
                ->middleware('throttle:10,1')
                ->middleware('can:logins.reveal');

            Route::get('/work-types', [WorkTypeController::class, 'index'])
                ->middleware('can:clients.view');
            Route::post('/work-types', [WorkTypeController::class, 'store'])
                ->middleware('can:settings.manage');
            Route::put('/work-types/{workType}', [WorkTypeController::class, 'update'])
                ->middleware('can:settings.manage');
            Route::delete('/work-types/{workType}', [WorkTypeController::class, 'destroy'])
                ->middleware('can:settings.manage');

            /*
             * Quotes and invoices. Written under a client, then worked on by
             * their own id. Issued ones are not editable and not deletable -
             * only paid, accepted, declined or cancelled.
             */
            Route::post('/clients/{client}/documents', [DocumentController::class, 'store'])
                ->middleware('can:money.manage');
            Route::put('/documents/{document}', [DocumentController::class, 'update'])
                ->middleware('can:money.manage');
            Route::post('/documents/{document}/issue', [DocumentController::class, 'issue'])
                ->middleware('can:money.manage');
            Route::post('/documents/{document}/status', [DocumentController::class, 'status'])
                ->middleware('can:money.manage');
            Route::post('/documents/{document}/client-details', [DocumentController::class, 'refreshClient'])
                ->middleware('can:money.manage');
            Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])
                ->middleware('can:money.manage');
            // An issued invoice, sent to the client on WhatsApp with its PDF.
            Route::post('/documents/{document}/whatsapp', DocumentWhatsAppController::class)
                ->middleware('throttle:10,1')
                ->middleware('can:money.manage');

            Route::post('/documents/{document}/payments', [PaymentController::class, 'store'])
                ->middleware('can:money.manage');
            Route::delete('/payments/{payment}', [PaymentController::class, 'destroy'])
                ->middleware('can:money.manage');
            // "Payment received", told to the client on WhatsApp.
            Route::post('/payments/{payment}/whatsapp', PaymentWhatsAppController::class)
                ->middleware('throttle:10,1')
                ->middleware('can:money.manage');

            Route::get('/billing-profile', [BillingProfileController::class, 'show'])
                ->middleware('can:money.view');
            Route::put('/billing-profile', [BillingProfileController::class, 'update'])
                ->middleware('can:settings.manage');

            Route::get('/leads', [AdminLeadController::class, 'index'])
                ->middleware('can:leads.view');
            Route::get('/leads/{lead}', [AdminLeadController::class, 'show'])
                ->middleware('can:leads.view');
            Route::patch('/leads/{lead}', [AdminLeadController::class, 'update'])
                ->middleware('can:leads.manage');
            Route::delete('/leads/{lead}', [AdminLeadController::class, 'destroy'])
                ->middleware('can:leads.manage');
            // Answering an enquiry by email, with a first draft from AI if asked.
            Route::post('/leads/{lead}/reply/draft', [LeadReplyController::class, 'draft'])
                ->middleware(['can:ai.use', 'can:leads.manage', 'throttle:20,1']);
            Route::post('/leads/{lead}/reply', [LeadReplyController::class, 'send'])
                ->middleware('throttle:10,1')
                ->middleware('can:leads.manage');
            Route::get('/lead-reply-templates', [LeadReplyTemplateController::class, 'index'])
                ->middleware('can:leads.view');
            Route::put('/lead-reply-templates', [LeadReplyTemplateController::class, 'update'])
                ->middleware('can:leads.manage');
        });

        Route::get('/auth/me', fn (Request $request) => response()->json([
            'data' => $request->user()->profile(),
        ]));
    });
});
