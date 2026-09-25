<?php

namespace App\Console\Commands;

use App\Services\WhatsAppClient;
use Illuminate\Console\Command;

/**
 * Points Meta's WhatsApp webhooks at the API. Run once, after the webhook
 * route is live and WHATSAPP_VERIFY_TOKEN and FACEBOOK_APP_SECRET are set
 * where it runs: Meta calls the URL straight away to check the token.
 */
class ConnectWhatsAppWebhook extends Command
{
    protected $signature = 'whatsapp:connect-webhook {url=https://api.jalimx.com/api/v1/whatsapp/webhook}';

    protected $description = "Subscribe the app to the WhatsApp account's messages and set the webhook URL";

    public function handle(): int
    {
        $client = WhatsAppClient::fromConfig();
        $token = (string) config('services.whatsapp.verify_token');
        $secret = (string) config('services.whatsapp.app_secret');

        if (! $client->configured() || $token === '' || $secret === '') {
            $this->error('Needs the WhatsApp credentials, WHATSAPP_VERIFY_TOKEN and FACEBOOK_APP_SECRET.');

            return self::FAILURE;
        }

        $client->connectWebhook($this->argument('url'), $token, $secret);
        $this->info('Connected: Meta will post messages to '.$this->argument('url'));

        return self::SUCCESS;
    }
}
