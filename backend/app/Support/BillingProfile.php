<?php

namespace App\Support;

use App\Models\Setting;

/**
 * Who the invoice is from.
 *
 * Kept in settings rather than a table of one row, and every field is
 * optional on purpose: JalimX is a freelancer today with no company number
 * and no VAT registration, and a form that demands an ICE before the first
 * invoice can be written would be a form that cannot be used. What is empty
 * is simply left off the page.
 */
class BillingProfile
{
    private const KEY = 'billing_profile';

    /** field => max length. The rate and the long text are handled apart. */
    public const FIELDS = [
        'name' => 120,
        'legal_name' => 160,
        'address' => 190,
        'city' => 80,
        'country' => 80,
        'email' => 190,
        'phone' => 40,
        'ice' => 20,
        'if' => 20,
        'rc' => 30,
        'patente' => 30,
        'bank_name' => 80,
        'rib' => 34,
    ];

    /** @return array<string, mixed> */
    public static function current(): array
    {
        $stored = Setting::map()[self::KEY] ?? [];

        $out = [];
        foreach (array_keys(self::FIELDS) as $field) {
            $out[$field] = (string) ($stored[$field] ?? '');
        }

        // Defaults that make the first invoice sensible without any setup.
        $out['name'] = $out['name'] !== '' ? $out['name'] : (string) config('app.name');
        $out['country'] = $out['country'] !== '' ? $out['country'] : 'Morocco';
        $out['tva_rate'] = (string) ($stored['tva_rate'] ?? '0.00');
        $out['payment_terms'] = (string) ($stored['payment_terms'] ?? '');
        $out['footer_note'] = (string) ($stored['footer_note'] ?? '');

        return $out;
    }

    /** @param array<string, mixed> $data */
    public static function save(array $data): void
    {
        $setting = Setting::firstOrNew(['key' => self::KEY]);
        $setting->value = $data;
        $setting->save();
    }
}
