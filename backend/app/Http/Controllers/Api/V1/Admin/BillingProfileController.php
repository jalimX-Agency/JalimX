<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Support\BillingProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The details that appear at the top of every invoice.
 *
 * Everything but the trading name is optional, and stays optional: the
 * company numbers arrive when the company does, and until then the invoice
 * simply does not print a line for them.
 */
class BillingProfileController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => BillingProfile::current()]);
    }

    public function update(Request $request): JsonResponse
    {
        $rules = [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\s.-]*$/'],
            // Zero is the honest default until JalimX is VAT registered;
            // the field is here so that day costs nothing.
            'tva_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'payment_terms' => ['nullable', 'string', 'max:2000'],
            'footer_note' => ['nullable', 'string', 'max:500'],
        ];

        foreach (BillingProfile::FIELDS as $field => $max) {
            if (! isset($rules[$field])) {
                $rules[$field] = ['nullable', 'string', "max:$max"];
            }
        }

        $data = $request->validate($rules, [
            'phone.regex' => 'Digits, spaces, + ( ) . and - only.',
        ], ['tva_rate' => 'VAT rate']);

        BillingProfile::save(array_map(
            fn ($value) => is_string($value) ? trim($value) : $value,
            $data,
        ));

        return response()->json(['data' => BillingProfile::current()]);
    }
}
