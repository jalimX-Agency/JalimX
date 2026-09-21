@php
    /**
     * One page of paper. Plain CSS only: dompdf reads a small, old subset,
     * and anything clever here fails silently in the render rather than
     * loudly in a browser.
     */
    $isInvoice = $document->type === 'invoice';
    $heading = $isInvoice ? 'FACTURE' : 'DEVIS';
    $currency = $document->currency;

    $money = fn ($amount) => number_format((float) $amount, 2, ',', ' ').' '.$currency;
    $day = fn ($date) => $date ? $date->format('d/m/Y') : '—';
    $lines = fn (array $parts) => array_values(array_filter($parts, fn ($p) => filled($p)));
    // "Marrakech, Morocco" — and just "Morocco" when there is no city.
    $place = fn ($city, $country) => implode(', ', array_filter([$city, $country], 'filled'));

    /*
     * The mark, as a data URI. A separate print copy of the file, because
     * the one the site uses paints itself with currentColor and a CSS
     * variable, and the PDF renderer understands neither - it would come
     * out black on black, or not at all.
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
    <title>{{ $document->number ?? $heading }}</title>
    <style>
        @page { margin: 18mm 16mm; }
        body {
            font-family: DejaVu Sans, sans-serif;
            font-size: 10pt;
            color: #1a1a1a;
            line-height: 1.45;
        }
        .muted { color: #6b6b6b; }
        .small { font-size: 8.5pt; }
        table { width: 100%; border-collapse: collapse; }
        td, th { vertical-align: top; }

        .head td { padding-bottom: 2mm; }
        .mark { width: 22mm; margin-bottom: 4mm; }
        .title { font-size: 20pt; letter-spacing: 2px; font-weight: bold; }
        .draft {
            display: inline-block;
            margin-left: 4mm;
            padding: 1mm 2mm;
            border: 1px solid #b23b3b;
            color: #b23b3b;
            font-size: 8pt;
            letter-spacing: 1px;
        }
        .meta td { padding: 0.7mm 0; }
        .meta .label { color: #6b6b6b; padding-right: 4mm; }

        .parties { margin-top: 8mm; }
        .parties td { width: 50%; padding-right: 8mm; }
        .party-label {
            font-size: 8pt;
            letter-spacing: 1.5px;
            color: #6b6b6b;
            border-bottom: 0.5pt solid #d8d8d8;
            padding-bottom: 1.5mm;
            margin-bottom: 2mm;
        }
        .party-name { font-weight: bold; }

        .items { margin-top: 9mm; }
        .items th {
            text-align: left;
            font-size: 8pt;
            letter-spacing: 1px;
            color: #6b6b6b;
            border-bottom: 0.8pt solid #1a1a1a;
            padding: 0 0 2mm;
        }
        .items td { padding: 2.5mm 0; border-bottom: 0.5pt solid #e6e6e6; }
        .num { text-align: right; white-space: nowrap; }

        .totals { margin-top: 5mm; }
        .totals td { padding: 1.2mm 0; }
        .totals .grand td {
            border-top: 0.8pt solid #1a1a1a;
            padding-top: 2.5mm;
            font-weight: bold;
            font-size: 11pt;
        }
        .totals .due td { color: #b23b3b; font-weight: bold; }

        .block { margin-top: 8mm; }
        .block-label {
            font-size: 8pt;
            letter-spacing: 1.5px;
            color: #6b6b6b;
            margin-bottom: 1.5mm;
        }
        .footer {
            margin-top: 10mm;
            padding-top: 3mm;
            border-top: 0.5pt solid #d8d8d8;
            color: #6b6b6b;
        }
    </style>
</head>
<body>

<table class="head">
    <tr>
        <td>
            @if ($mark)
                <img class="mark" src="{{ $mark }}" alt="{{ $from['name'] ?? 'JalimX' }}">
            @endif
            <br>
            <span class="title">{{ $heading }}</span>
            @if ($document->status === 'draft')
                <span class="draft">BROUILLON</span>
            @elseif ($document->status === 'cancelled')
                <span class="draft">ANNULÉ</span>
            @endif
        </td>
        <td class="num">
            <table class="meta">
                @if ($document->number)
                    <tr>
                        <td class="label">N°</td>
                        <td class="num"><strong>{{ $document->number }}</strong></td>
                    </tr>
                @endif
                <tr>
                    <td class="label">Date</td>
                    <td class="num">{{ $day($document->issue_date) }}</td>
                </tr>
                @if ($isInvoice && $document->due_date)
                    <tr>
                        <td class="label">Échéance</td>
                        <td class="num">{{ $day($document->due_date) }}</td>
                    </tr>
                @endif
            </table>
        </td>
    </tr>
</table>

<table class="parties">
    <tr>
        <td>
            <div class="party-label">ÉMETTEUR</div>
            <div class="party-name">{{ $from['name'] ?? '' }}</div>
            @foreach ($lines([$from['legal_name'] ?? null, $from['address'] ?? null, $place($from['city'] ?? null, $from['country'] ?? null)]) as $line)
                <div>{{ $line }}</div>
            @endforeach
            @foreach ($lines([$from['email'] ?? null, $from['phone'] ?? null]) as $line)
                <div class="muted">{{ $line }}</div>
            @endforeach
            @php
                $ids = [];
                foreach (['ice' => 'ICE', 'if' => 'IF', 'rc' => 'RC', 'patente' => 'Patente'] as $key => $label) {
                    if (filled($from[$key] ?? null)) {
                        $ids[] = "$label : {$from[$key]}";
                    }
                }
            @endphp
            @if ($ids)
                <div class="small muted" style="margin-top: 2mm;">{{ implode(' · ', $ids) }}</div>
            @endif
        </td>
        <td>
            <div class="party-label">CLIENT</div>
            <div class="party-name">{{ $to['name'] ?? '' }}</div>
            @foreach ($lines([$to['contact_name'] ?? null, $to['address'] ?? null, $place($to['city'] ?? null, $to['country'] ?? null)]) as $line)
                <div>{{ $line }}</div>
            @endforeach
            @if (filled($to['ice'] ?? null))
                <div class="small muted" style="margin-top: 2mm;">ICE : {{ $to['ice'] }}</div>
            @endif
        </td>
    </tr>
</table>

@if (filled($document->subject))
    <div class="block">
        <div class="block-label">OBJET</div>
        <div>{{ $document->subject }}</div>
    </div>
@endif

<table class="items">
    <thead>
        <tr>
            <th>DÉSIGNATION</th>
            <th class="num">QTÉ</th>
            <th class="num">PRIX UNITAIRE</th>
            <th class="num">MONTANT</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($document->items as $item)
            <tr>
                <td>{{ $item->description }}</td>
                <td class="num">{{ rtrim(rtrim(number_format((float) $item->quantity, 2, ',', ' '), '0'), ',') }}</td>
                <td class="num">{{ $money($item->unit_price) }}</td>
                <td class="num">{{ $money($item->totalCentimes() / 100) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table class="totals">
    <tr>
        <td></td>
        <td style="width: 45%;">
            <table>
                <tr>
                    <td class="muted">Total HT</td>
                    <td class="num">{{ $money($totals['subtotal']) }}</td>
                </tr>
                <tr>
                    <td class="muted">
                        TVA {{ rtrim(rtrim(number_format((float) $document->tva_rate, 2, ',', ' '), '0'), ',') }} %
                    </td>
                    <td class="num">{{ $money($totals['tva']) }}</td>
                </tr>
                <tr class="grand">
                    <td>Total TTC</td>
                    <td class="num">{{ $money($totals['total']) }}</td>
                </tr>
                @if ((float) $totals['paid'] > 0)
                    <tr>
                        <td class="muted">Déjà réglé</td>
                        <td class="num">− {{ $money($totals['paid']) }}</td>
                    </tr>
                    <tr class="due">
                        <td>Reste à payer</td>
                        <td class="num">{{ $money($totals['due']) }}</td>
                    </tr>
                @endif
            </table>
        </td>
    </tr>
</table>

@if ((float) $document->tva_rate === 0.0)
    {{-- Required wording when no VAT is charged; without it the zero looks
         like an omission rather than a position. --}}
    <div class="small muted" style="margin-top: 4mm;">TVA non applicable.</div>
@endif

@if ($document->payments->isNotEmpty())
    <div class="block">
        <div class="block-label">RÈGLEMENTS</div>
        @foreach ($document->payments as $payment)
            <div class="small">
                {{ $day($payment->paid_on) }} — {{ $money($payment->amount) }}
                ({{ $payment->method }}){{ filled($payment->reference) ? ' · '.$payment->reference : '' }}
            </div>
        @endforeach
    </div>
@endif

@if (filled($document->terms))
    <div class="block">
        <div class="block-label">CONDITIONS DE PAIEMENT</div>
        <div class="small">{!! nl2br(e($document->terms)) !!}</div>
    </div>
@endif

@if (filled($document->notes))
    <div class="block">
        <div class="block-label">NOTES</div>
        <div class="small">{!! nl2br(e($document->notes)) !!}</div>
    </div>
@endif

@if (filled($from['bank_name'] ?? null) || filled($from['rib'] ?? null))
    <div class="block">
        <div class="block-label">COORDONNÉES BANCAIRES</div>
        <div class="small">
            {{ implode(' · ', $lines([$from['bank_name'] ?? null, $from['rib'] ?? null])) }}
        </div>
    </div>
@endif

@if (filled($from['footer_note'] ?? null))
    <div class="footer small">{{ $from['footer_note'] }}</div>
@endif

</body>
</html>
