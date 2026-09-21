@php
    /**
     * The access sheet handed to a client. Same paper as the invoice:
     * plain CSS for dompdf, the print copy of the mark, French.
     *
     * Each login is a block rather than a table row: passwords and URLs
     * are long and unbreakable, and a table squeezes them into columns
     * where a character wraps onto the next line and gets typed wrong.
     */
    $markFile = resource_path('brand/jx-mark-print.svg');
    $mark = is_file($markFile)
        ? 'data:image/svg+xml;base64,'.base64_encode(file_get_contents($markFile))
        : null;
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <title>Accès — {{ $client->name }}</title>
    <style>
        @page { margin: 18mm 16mm; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.45; }
        .muted { color: #6b6b6b; }
        .small { font-size: 8.5pt; }
        .mark { width: 22mm; margin-bottom: 4mm; }
        .title { font-size: 20pt; letter-spacing: 2px; font-weight: bold; }
        .for { margin-top: 2mm; }
        .warning {
            margin-top: 6mm;
            padding: 3mm 4mm;
            border: 0.8pt solid #b23b3b;
            color: #b23b3b;
            font-size: 8.5pt;
        }
        .login {
            margin-top: 6mm;
            border: 0.5pt solid #d8d8d8;
            page-break-inside: avoid;
        }
        .login-head {
            padding: 2.5mm 4mm;
            background: #f4f4f4;
            border-bottom: 0.5pt solid #d8d8d8;
            font-weight: bold;
        }
        .login-head .work { font-weight: normal; color: #6b6b6b; }
        .fields { width: 100%; border-collapse: collapse; }
        .fields td { padding: 2mm 4mm; vertical-align: top; }
        .fields .label {
            width: 30mm;
            font-size: 8pt;
            letter-spacing: 1px;
            color: #6b6b6b;
        }
        .value { font-family: DejaVu Sans Mono, monospace; word-wrap: break-word; }
        .footer { margin-top: 10mm; padding-top: 3mm; border-top: 0.5pt solid #d8d8d8; }
    </style>
</head>
<body>

@if ($mark)
    <img class="mark" src="{{ $mark }}" alt="{{ $from['name'] ?? 'JalimX' }}">
@endif

<div class="title">ACCÈS</div>
<div class="for">
    <strong>{{ $client->legal_name ?: $client->name }}</strong>
    <span class="muted"> · {{ now()->format('d/m/Y') }}</span>
</div>

<div class="warning">
    Document confidentiel. Il contient des mots de passe : ne le transférez pas,
    et changez-les à la première connexion.
</div>

@foreach ($credentials as $credential)
    <div class="login">
        <div class="login-head">
            {{ $credential->label }}
            @if ($credential->engagement)
                <span class="work"> · {{ $credential->engagement->title }}</span>
            @endif
        </div>
        <table class="fields">
            @if (filled($credential->url))
                <tr>
                    <td class="label">ADRESSE</td>
                    <td class="value">{{ $credential->url }}</td>
                </tr>
            @endif
            @if (filled($credential->username))
                <tr>
                    <td class="label">IDENTIFIANT</td>
                    <td class="value">{{ $credential->username }}</td>
                </tr>
            @endif
            <tr>
                <td class="label">MOT DE PASSE</td>
                <td class="value">{{ filled($credential->secret) ? $credential->secret : '—' }}</td>
            </tr>
            @if (filled($credential->notes))
                <tr>
                    <td class="label">NOTES</td>
                    <td class="small">{!! nl2br(e($credential->notes)) !!}</td>
                </tr>
            @endif
        </table>
    </div>
@endforeach

<div class="footer small muted">
    {{ $from['name'] ?? 'JalimX' }}
    @if (filled($from['email'] ?? null)) · {{ $from['email'] }} @endif
    @if (filled($from['phone'] ?? null)) · {{ $from['phone'] }} @endif
</div>

</body>
</html>
