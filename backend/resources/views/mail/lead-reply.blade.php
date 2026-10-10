<x-mail::message>
{{ $body }}

@if ($whatsappUrl)
<x-mail::button :url="$whatsappUrl">
{{ $buttonLabel }}
</x-mail::button>
@endif
</x-mail::message>
