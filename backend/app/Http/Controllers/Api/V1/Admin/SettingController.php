<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The site-wide words and contact details.
 *
 * Only keys the site actually renders are editable here. The table can hold
 * more (social handles, locales) but a field in the dashboard that changes
 * nothing on the site is worse than no field.
 */
class SettingController extends Controller
{
    /**
     * key => shape: 'translated' is {en, fr}; 'text' is {value}; 'numbers' is
     * {values: [...]}, written one per line in the dashboard.
     */
    private const EDITABLE = [
        'hero_headline' => 'translated',
        'hero_body' => 'translated',
        'contact_email' => 'text',
        'contact_phone' => 'text',
        'contact_whatsapp' => 'numbers',
        'contact_location' => 'text',
    ];

    /** The most numbers the site will list; more reads as a switchboard. */
    private const MAX_NUMBERS = 5;

    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->current()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'hero_headline.en' => ['required', 'string', 'max:80'],
            'hero_headline.fr' => ['required', 'string', 'max:80'],
            'hero_body.en' => ['required', 'string', 'max:400'],
            'hero_body.fr' => ['required', 'string', 'max:400'],
            'contact_email' => ['required', 'email:rfc', 'max:190'],
            'contact_phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\s.-]*$/'],
            'contact_whatsapp' => ['nullable', 'string', 'max:400'],
            'contact_location' => ['nullable', 'string', 'max:80'],
        ], [
            'contact_phone.regex' => 'Digits, spaces, + ( ) . and - only.',
        ]);

        $whatsapp = $this->numbers((string) ($data['contact_whatsapp'] ?? ''));

        DB::transaction(function () use ($data, $whatsapp) {
            foreach (self::EDITABLE as $key => $shape) {
                $value = match ($shape) {
                    'translated' => ['en' => trim($data[$key]['en']), 'fr' => trim($data[$key]['fr'])],
                    'numbers' => ['values' => $whatsapp],
                    default => ['value' => trim((string) ($data[$key] ?? ''))],
                };

                $setting = Setting::firstOrNew(['key' => $key]);

                // Saved only when it changed: each save tells the site to
                // rebuild, and five identical rebuilds are four too many.
                if ($setting->value !== $value) {
                    $setting->value = $value;
                    $setting->save();
                }
            }
        });

        return response()->json(['data' => $this->current()]);
    }

    /**
     * The numbers typed in the box, one per line, as digits with the country
     * code. A line that cannot be a phone number is refused by name rather
     * than dropped, because a number that quietly vanished is one a client
     * could never reach.
     *
     * @return list<string>
     */
    private function numbers(string $lines): array
    {
        $out = [];

        foreach (preg_split('/\R+/', $lines) ?: [] as $line) {
            if (trim($line) === '') {
                continue;
            }

            $digits = PhoneNumber::forWhatsApp($line);
            if ($digits === null) {
                throw ValidationException::withMessages([
                    'contact_whatsapp' => '“'.trim($line).'” is not a number WhatsApp can use. Write it with its country code, e.g. +212 6…',
                ]);
            }

            $out[$digits] = $digits;
        }

        if (count($out) > self::MAX_NUMBERS) {
            throw ValidationException::withMessages([
                'contact_whatsapp' => 'List at most '.self::MAX_NUMBERS.' numbers.',
            ]);
        }

        return array_values($out);
    }

    /** @return array{hero_headline: array{en: string, fr: string}, hero_body: array{en: string, fr: string}, contact_email: string, contact_phone: string, contact_location: string} */
    private function current(): array
    {
        $map = Setting::map();
        $out = [];

        foreach (self::EDITABLE as $key => $shape) {
            $value = $map[$key] ?? [];
            $out[$key] = match ($shape) {
                'translated' => ['en' => (string) ($value['en'] ?? ''), 'fr' => (string) ($value['fr'] ?? '')],
                // Shown the way the site shows them, one per line.
                'numbers' => implode("\n", array_map(
                    fn ($n) => PhoneNumber::display((string) $n),
                    $value['values'] ?? [],
                )),
                default => (string) ($value['value'] ?? ''),
            };
        }

        return $out;
    }
}
