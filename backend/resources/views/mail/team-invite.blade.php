<x-mail::message>
Hello {{ $name }},

{{ $invitedBy ?? config('app.name') }} has added you to the {{ config('app.name') }} dashboard, as **{{ $role }}**.

Choose your password to sign in:

<x-mail::button :url="$url">
Choose a password
</x-mail::button>

The link works once and until {{ $expires }}. If you were not expecting this, you can ignore this email.

{{ config('app.name') }}
</x-mail::message>
