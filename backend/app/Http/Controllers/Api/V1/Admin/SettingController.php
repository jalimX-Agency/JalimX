<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The site-wide words and contact details.
 *
 * Only keys the site actually renders are editable here. The table can hold
 * more (social handles, locales) but a field in the dashboard that changes
 * nothing on the site is worse than no field.
 */
class SettingController extends Controller
{
    /** key => shape: 'translated' is {en, fr}; 'text' is {value}. */
    private const EDITABLE = [
        'hero_headline' => 'translated',
        'hero_body' => 'translated',
        'contact_email' => 'text',
        'contact_phone' => 'text',
        'contact_location' => 'text',
    ];

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
            'contact_location' => ['nullable', 'string', 'max:80'],
        ], [
            'contact_phone.regex' => 'Digits, spaces, + ( ) . and - only.',
        ]);

        DB::transaction(function () use ($data) {
            foreach (self::EDITABLE as $key => $shape) {
                $value = $shape === 'translated'
                    ? ['en' => trim($data[$key]['en']), 'fr' => trim($data[$key]['fr'])]
                    : ['value' => trim((string) ($data[$key] ?? ''))];

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

    /** @return array{hero_headline: array{en: string, fr: string}, hero_body: array{en: string, fr: string}, contact_email: string, contact_phone: string, contact_location: string} */
    private function current(): array
    {
        $map = Setting::map();
        $out = [];

        foreach (self::EDITABLE as $key => $shape) {
            $value = $map[$key] ?? [];
            $out[$key] = $shape === 'translated'
                ? ['en' => (string) ($value['en'] ?? ''), 'fr' => (string) ($value['fr'] ?? '')]
                : (string) ($value['value'] ?? '');
        }

        return $out;
    }
}
