<x-mail::message>
Bonjour {{ $name }},

@if ($protected)
Vous trouverez en pièce jointe vos accès ({{ $count }} {{ $count === 1 ? 'compte' : 'comptes' }}), dans un PDF protégé par un mot de passe.

**Le mot de passe ne figure pas dans ce message.** Nous vous l'envoyons séparément, par téléphone ou WhatsApp : ainsi, ce message seul ne suffit pas à ouvrir le document.
@else
Vous trouverez en pièce jointe vos accès ({{ $count }} {{ $count === 1 ? 'compte' : 'comptes' }}), en PDF.
@endif

@if ($note)
{{ $note }}

@endif
Nous vous conseillons de changer ces mots de passe à la première connexion, et de ne pas transférer ce document.

Bien cordialement,<br>
{{ config('app.name') }}
</x-mail::message>
