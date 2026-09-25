<?php

namespace App\Support;

/**
 * A phone number the way WhatsApp wants it: digits only, with the country
 * code, no "+" and no leading zeros.
 */
final class PhoneNumber
{
    /**
     * A Moroccan number written the local way (06…, 07…, 05…) gets its
     * 212; one that already has a country code keeps it. Null when what is
     * left cannot be a phone number.
     */
    public static function forWhatsApp(?string $input): ?string
    {
        $digits = preg_replace('/\D+/', '', (string) $input);
        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }
        if (strlen($digits) === 10 && str_starts_with($digits, '0')) {
            $digits = '212'.substr($digits, 1);
        }
        // "+212 (0)6…" written with the trunk zero kept.
        if (str_starts_with($digits, '2120') && strlen($digits) === 13) {
            $digits = '212'.substr($digits, 4);
        }

        return preg_match('/^[1-9]\d{9,14}$/', $digits) ? $digits : null;
    }
}
