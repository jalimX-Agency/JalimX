<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Services\ReminderSender;
use App\Services\WhatsAppClient;
use App\Support\ReminderTemplates;
use App\Support\TaskReminderMessage;
use App\Support\WhatsAppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * Settings → WhatsApp: is it connected, which number gets the reminders,
 * and what the reminder templates say.
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
            'footer' => ReminderTemplates::FOOTER,
            'button' => ReminderTemplates::BUTTON_TEXT,
        ]]);
    }

    public function updateRecipient(Request $request): JsonResponse
    {
        $data = $request->validate(['recipient' => ['required', 'string', 'max:30']]);

        $number = self::normalise($data['recipient']);
        if ($number === null) {
            throw ValidationException::withMessages([
                'recipient' => 'Write the number with its country code, e.g. 212612345678 or 0612345678.',
            ]);
        }

        WhatsAppSettings::saveRecipient($number);

        return response()->json(['data' => ['recipient' => $number]]);
    }

    /**
     * Saves a template's wording and sends it to Meta: created if it does
     * not exist there yet, edited if it does. Either way it goes to review.
     */
    public function updateTemplate(Request $request, string $key): JsonResponse
    {
        $def = $this->definition($key);
        $data = $request->validate(['body' => ['required', 'string', 'max:1024']]);
        $body = str_replace("\r\n", "\n", trim($data['body']));

        if ($problem = ReminderTemplates::problem($body, count($def['params']))) {
            throw ValidationException::withMessages(['body' => $problem]);
        }

        $this->submit($def, $body);

        return $this->show();
    }

    /** Creates every reminder template Meta does not have yet, as written in the code. */
    public function createMissing(): JsonResponse
    {
        $client = $this->client();
        $live = $client->templates();

        foreach (ReminderTemplates::all() as $def) {
            if (! isset($live[$def['name']])) {
                $client->createTemplate(
                    $def['name'],
                    ReminderTemplates::LANGUAGE,
                    ReminderTemplates::components($def['body'], $def['example']),
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
        $def = ReminderTemplates::get('full');
        $params = $def['example'];
        $params[1] = TaskReminderMessage::when(Carbon::now()->addHours(3));

        $used = (new ReminderSender($this->client()))->send('full', $params);

        return response()->json(['data' => [
            'template' => $used,
            'to' => WhatsAppSettings::recipient(),
        ]]);
    }

    /** @param array{name: string, example: list<string>} $def */
    private function submit(array $def, string $body): void
    {
        $client = $this->client();
        $live = $client->templates()[$def['name']] ?? null;
        $components = ReminderTemplates::components($body, $def['example']);

        if ($live) {
            $client->editTemplate($live['id'], $components);
        } else {
            $client->createTemplate($def['name'], ReminderTemplates::LANGUAGE, $components);
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $live
     * @return list<array<string, mixed>>
     */
    private function templates(array $live): array
    {
        $out = [];
        foreach (ReminderTemplates::all() as $key => $def) {
            $t = $live[$def['name']] ?? null;
            $out[] = [
                'key' => $key,
                'name' => $def['name'],
                'label' => $def['label'],
                'hint' => $def['hint'],
                'params' => $def['params'],
                'example' => $def['example'],
                'default_body' => $def['body'],
                // What Meta has, when it has it; otherwise what would be sent.
                'body' => $t['body'] ?? $def['body'],
                'status' => $t['status'] ?? null,
                'rejected_reason' => $t['rejected_reason'] ?? null,
            ];
        }

        return $out;
    }

    /** @return array{name: string, params: list<string>, example: list<string>} */
    private function definition(string $key): array
    {
        abort_unless(array_key_exists($key, ReminderTemplates::all()), 404);

        return ReminderTemplates::get($key);
    }

    private function client(): WhatsAppClient
    {
        $client = WhatsAppClient::fromConfig();
        abort_unless($client->configured(), 409, 'WhatsApp is not connected on the server.');

        return $client;
    }

    /**
     * Digits only, with the country code, the way Meta wants it. A
     * Moroccan number written the local way (06…, 07…) gets its 212.
     */
    public static function normalise(string $input): ?string
    {
        $digits = preg_replace('/\D+/', '', $input);
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }
        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            $digits = '212'.substr($digits, 1);
        }

        return preg_match('/^[1-9]\d{9,14}$/', $digits) ? $digits : null;
    }
}
