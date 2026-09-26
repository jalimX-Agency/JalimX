<?php

namespace App\Support;

use Barryvdh\DomPDF\Facade\Pdf;
use InvalidArgumentException;

/**
 * The WhatsApp templates that go to clients, each carrying a PDF.
 *
 * In French, like the invoice itself: it is the language a Moroccan
 * client's accountant reads. The file travels as the message's header,
 * so the client sees the document first and the words under it.
 */
final class ClientTemplates
{
    public const LANGUAGE = 'fr';

    public const FOOTER = 'JalimX · jalimx.com';

    /** @return array<string, array{name: string, label: string, hint: string, params: list<string>, body: string, example: list<string>, sample_file: string}> */
    public static function all(): array
    {
        return [
            'invoice' => [
                'name' => 'jalimx_invoice',
                'label' => 'Invoice',
                'hint' => 'Sent with the invoice PDF attached.',
                'params' => ['Client', 'Invoice number', 'Amount to pay', 'Due date'],
                'body' => "Bonjour {{1}},\n\nVeuillez trouver ci-joint votre facture *{{2}}*.\n\n💰 Montant à régler : *{{3}}*\n📅 Échéance : *{{4}}*\n\nPour toute question, il vous suffit de répondre à ce message.\n\nMerci pour votre confiance,\nL'équipe JalimX",
                'example' => ['Riad Dar Anika', 'FAC-2026-0001', '6 000,00 MAD', '30/10/2026'],
                'sample_file' => 'FAC-2026-0001.pdf',
            ],
            'logins' => [
                'name' => 'jalimx_logins',
                'label' => 'Logins',
                'hint' => 'Sent with the password-protected logins PDF attached.',
                'params' => ['Client', 'What is inside'],
                'body' => "Bonjour {{1}},\n\nVous trouverez ci-joint le document contenant {{2}}.\n\n🔒 Le fichier est protégé par un mot de passe, que nous vous communiquons séparément.\n\nMerci de le conserver en lieu sûr et de ne pas le transférer.\n\nL'équipe JalimX",
                'example' => ['Riad Dar Anika', 'vos 2 accès (Hébergement, WordPress)'],
                'sample_file' => 'acces-riad-dar-anika.pdf',
            ],
            // The same sheet sent without a password: its own wording, so
            // the message does not announce a password that never comes.
            'logins_open' => [
                'name' => 'jalimx_logins_open',
                'label' => 'Logins (no password)',
                'hint' => 'Sent with the logins PDF attached, when you chose not to protect it.',
                'params' => ['Client', 'What is inside'],
                'body' => "Bonjour {{1}},\n\nVous trouverez ci-joint le document contenant {{2}}.\n\nMerci de le conserver en lieu sûr et de ne pas le transférer.\n\nL'équipe JalimX",
                'example' => ['Riad Dar Anika', 'vos 2 accès (Hébergement, WordPress)'],
                'sample_file' => 'acces-riad-dar-anika.pdf',
            ],
        ];
    }

    /** @return array{name: string, label: string, hint: string, params: list<string>, body: string, example: list<string>, sample_file: string} */
    public static function get(string $key): array
    {
        return self::all()[$key] ?? throw new InvalidArgumentException("Unknown client template [{$key}].");
    }

    /**
     * @param  list<string>  $example
     * @param  string  $handle  A sample document from WhatsAppClient::uploadExample().
     * @return list<array<string, mixed>>
     */
    public static function components(string $body, array $example, string $handle): array
    {
        return [
            ['type' => 'HEADER', 'format' => 'DOCUMENT', 'example' => ['header_handle' => [$handle]]],
            ['type' => 'BODY', 'text' => $body, 'example' => ['body_text' => [$example]]],
            ['type' => 'FOOTER', 'text' => self::FOOTER],
        ];
    }

    /** A one-page PDF for Meta's reviewers to look at; no real client in it. */
    public static function samplePdf(string $label): string
    {
        return Pdf::loadHTML(
            '<div style="font-family: DejaVu Sans, sans-serif; padding: 60px;">'
            .'<h1 style="font-size: 22px;">JalimX</h1>'
            .'<p style="font-size: 14px;">Exemple de document : '.e($label).'</p>'
            .'</div>'
        )->setPaper('a4')->output();
    }
}
