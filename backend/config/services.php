<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    /*
     * The Next.js frontend. Used to invalidate its cached content tags after an
     * edit - see App\Services\SiteRevalidator.
     */
    'frontend' => [
        'url' => env('FRONTEND_URL'),
        'revalidate_secret' => env('REVALIDATE_SECRET'),
    ],

    /*
     * Where "someone filled in the contact form" is emailed. Unset, no email
     * is sent; the lead is still saved and waits in the dashboard.
     */
    'leads' => [
        'notify' => env('LEADS_NOTIFY_EMAIL'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
     * Task reminders, sent to the agency's own phone. Not the client's —
     * this is Mohamed's WhatsApp, not a client-facing channel.
     */
    'whatsapp' => [
        'token' => env('WHATSAPP_TOKEN'),
        'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
        'business_account_id' => env('WHATSAPP_BUSINESS_ACCOUNT_ID'),
        // International format, no "+" or leading zeros: 2126XXXXXXXX.
        'recipient' => env('WHATSAPP_RECIPIENT'),
    ],

];
