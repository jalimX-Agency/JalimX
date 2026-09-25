<x-mail::message>
**{{ $who }}** wrote on WhatsApp{{ $client && $client !== $who ? " ({$client})" : '' }}, from {{ $number }}:

<x-mail::panel>
{{ $preview }}
</x-mail::panel>

<x-mail::button :url="$url">
Open the conversation
</x-mail::button>

More messages from the same person in the next ten minutes will not send another email.

{{ config('app.name') }}
</x-mail::message>
