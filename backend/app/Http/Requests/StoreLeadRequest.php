<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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

    protected function prepareForValidation(): void
    {
        $this->merge([
            'locale' => $this->input('locale', 'en'),
        ]);
    }
}
