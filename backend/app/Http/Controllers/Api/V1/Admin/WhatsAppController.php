<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReminderSender;
use App\Services\WhatsAppClient;
use App\Support\ClientTemplates;
use App\Support\PhoneNumber;
use App\Support\ReminderTemplates;
use App\Support\TaskReminderMessage;
use App\Support\WhatsAppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Settings → WhatsApp: is it connected, which number gets the reminders,
 * and what every template says — the reminders to the agency, and the
 * invoice and logins messages to clients.
 *
 * The credentials themselves are not here and cannot be changed here:
 * they stay in the server's environment.
 */
class WhatsAppController extends Controller
{
    public function show(): JsonResponse
    {
        $client = WhatsAppClient::fromConfig();

        $connection = null;
        $error = null;
        $live = [];

        if ($client->configured()) {
            try {
                $c = $client->checkConnection();
                $connection = [
                    'name' => (string) ($c['verified_name'] ?? ''),
                    'number' => (string) ($c['display_phone_number'] ?? ''),
                    'quality' => (string) ($c['quality_rating'] ?? ''),
                ];
                $live = $client->templates();
            } catch (\Throwable $e) {
                $error = $e->getMessage();
            }
        }

        return response()->json(['data' => [
            'configured' => $client->configured(),
            'connection' => $connection,
            'error' => $error,
            'recipient' => WhatsAppSettings::recipient(),
            'templates' => $this->templates($live),
            'legacy' => [
                'name' => ReminderTemplates::LEGACY,
                'status' => $live[ReminderTemplates::LEGACY]['status'] ?? null,
            ],
        ]]);
    }

    public function updateRecipient(Request $request): JsonResponse
    {
        $data = $request->validate(['recipient' => ['required', 'string', 'max:30']]);

        $number = PhoneNumber::forWhatsApp($data['recipient']) ?? throw ValidationException::withMessages([
            'recipient' => 'Write the number with its country code, e.g. 212612345678 or 0612345678.',
        ]);

        WhatsAppSettings::saveRecipient($number);

        return response()->json(['data' => ['recipient' => $number]]);
    }

    /**
     * Saves a template's wording and sends it to Meta: created if it does
     * not exist there yet, edited if it does. Either way it goes to review.
     */
    public function updateTemplate(Request $request, string $key): JsonResponse
    {
        $def = $this->registry()[$key] ?? abort(404);
        $data = $request->validate(['body' => ['required', 'string', 'max:1024']]);
        $body = str_replace("\r\n", "\n", trim($data['body']));

        if ($problem = ReminderTemplates::problem($body, count($def['params']))) {
            throw ValidationException::withMessages(['body' => $problem]);
        }

        $client = $this->client();
        $live = $client->templates()[$def['name']] ?? null;
        $components = $this->components($client, $def, $body);

        if ($live) {
            $client->editTemplate($live['id'], $components);
        } else {
            $client->createTemplate($def['name'], $def['language'], $components);
        }

        return $this->show();
    }

    /** Creates every template Meta does not have yet, as written in the code. */
    public function createMissing(): JsonResponse
    {
        $client = $this->client();
        $live = $client->templates();

        foreach ($this->registry() as $def) {
            if (! isset($live[$def['name']])) {
                $client->createTemplate(
                    $def['name'],
                    $def['language'],
                    $this->components($client, $def, $def['body']),
                );
            }
        }

        return $this->show();
    }

    /**
     * A sample reminder with every line filled, sent to the reminder
     * number, so the wording can be seen where it will actually be read.
     */
    public function test(): JsonResponse
    {
        $params = ReminderTemplates::get('full')['example'];
        $params[1] = TaskReminderMessage::when(Carbon::now()->addHours(3));

        $used = (new ReminderSender($this->client()))->send('full', $params);

        return response()->json(['data' => [
            'template' => $used,
            'to' => WhatsAppSettings::recipient(),
        ]]);
    }

    /**
     * Every template this app sends, reminders first, keyed the way the
     * dashboard refers to them.
     *
     * @return array<string, array<string, mixed>>
     */
    private function registry(): array
    {
        $out = [];
        foreach (ReminderTemplates::all() as $key => $def) {
            $out[$key] = [...$def, 'group' => 'reminders', 'language' => ReminderTemplates::LANGUAGE,
                'footer' => ReminderTemplates::FOOTER, 'button' => ReminderTemplates::BUTTON_TEXT, 'document' => null];
        }
        foreach (ClientTemplates::all() as $key => $def) {
            $out[$key] = [...$def, 'group' => 'clients', 'language' => ClientTemplates::LANGUAGE,
                'footer' => ClientTemplates::FOOTER, 'button' => null, 'document' => $def['sample_file']];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $def
     * @return list<array<string, mixed>>
     */
    private function components(WhatsAppClient $client, array $def, string $body): array
    {
        if ($def['group'] === 'reminders') {
            return ReminderTemplates::components($body, $def['example']);
        }

        // A template with a document needs a sample one for the reviewers.
        $handle = $client->uploadExample(ClientTemplates::samplePdf($def['label']), $def['sample_file']);

        return ClientTemplates::components($body, $def['example'], $handle);
    }

    /**
     * @param  array<string, array<string, mixed>>  $live
     * @return list<array<string, mixed>>
     */
    private function templates(array $live): array
    {
        $out = [];
        foreach ($this->registry() as $key => $def) {
            $t = $live[$def['name']] ?? null;
            $out[] = [
                'key' => $key,
                'group' => $def['group'],
                'name' => $def['name'],
                'language' => $def['language'],
                'label' => $def['label'],
                'hint' => $def['hint'],
                'params' => $def['params'],
                'example' => $def['example'],
                'footer' => $def['footer'],
                'button' => $def['button'],
                'document' => $def['document'],
                'default_body' => $def['body'],
                // What Meta has, when it has it; otherwise what would be sent.
                'body' => $t['body'] ?? $def['body'],
                'status' => $t['status'] ?? null,
                'rejected_reason' => $t['rejected_reason'] ?? null,
            ];
        }

        return $out;
    }

    private function client(): WhatsAppClient
    {
        $client = WhatsAppClient::fromConfig();
        abort_unless($client->configured(), 409, 'WhatsApp is not connected on the server.');

        return $client;
    }
}
