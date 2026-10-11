<?php

namespace App\Http\Requests;

use App\Services\Turnstile;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190'],
            // Required: a number is how these conversations actually start.
            // Written the way people write numbers anywhere: a "+" and a country
            // code, spaces, dots, dashes, brackets. Between 7 and 15 digits,
            // the range an international number can have (E.164).
            'phone' => ['required', 'string', 'max:40', function (string $attribute, mixed $value, \Closure $fail) {
                $digits = strlen((string) preg_replace('/\D/', '', (string) $value));

                if (! preg_match('/^\+?[\d\s().\-]+$/', (string) $value) || $digits < 7 || $digits > 15) {
                    $fail('Enter a valid phone number, with its country code.');
                }
            }],
            'company' => ['nullable', 'string', 'max:120'],
            'budget_range' => ['nullable', 'string', 'max:60'],
            'service_interest' => ['nullable', 'string', 'max:60'],
            'message' => ['required', 'string', 'min:10', 'max:5000'],
            'locale' => ['nullable', Rule::in(['en', 'fr'])],
            'source' => ['nullable', 'string', 'max:60'],
        ];
    }

    /**
     * The spam check, once the form itself is in order.
     *
     * Last, and only for a form that would otherwise be accepted: a token is
     * good for one try, so spending it on an enquiry that was going to bounce
     * for a missing phone number would make the visitor wait for a new one.
     * The token is read from the input and never validated as a field, so it
     * cannot end up in validated() and from there in the database.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if (! Turnstile::enabled() || $validator->errors()->isNotEmpty()) {
                return;
            }

            $result = app(Turnstile::class)->check(
                (string) $this->input('turnstile_token'),
                $this->ip(),
            );

            if ($result === Turnstile::FAILED) {
                $validator->errors()->add('turnstile', 'The spam check did not pass. Please try again.');
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'locale' => $this->input('locale', 'en'),
            // Numbers typed with Arabic-Indic or Persian digits (٠٦١٢…) are
            // the same numbers; store them the way every tool reads them.
            'phone' => is_string($this->input('phone'))
                ? strtr(trim($this->input('phone')), [
                    '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
                    '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
                    '۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
                    '۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
                ])
                : $this->input('phone'),
        ]);
    }
}
