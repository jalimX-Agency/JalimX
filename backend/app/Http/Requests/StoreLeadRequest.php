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
            'phone' => ['required', 'string', 'min:6', 'max:40'],
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
        ]);
    }
}
