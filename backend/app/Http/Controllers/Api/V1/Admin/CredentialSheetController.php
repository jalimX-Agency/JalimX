<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\ClientLoginsMail;
use App\Models\Client;
use App\Models\Credential;
use App\Services\ClientMessenger;
use App\Support\BillingProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * A client's logins, handed over on paper.
 *
 * The sheet is password-protected unless the person sending it says
 * otherwise — by download, email or WhatsApp alike. When it is, the
 * password is never put in the same message as the sheet: a message
 * carrying both is simply a message carrying the passwords. The dashboard
 * shows it once, for giving another way — a call, an SMS.
 *
 * The protection is the PDF format's own, which is RC4: a lock on the
 * door rather than a vault. It stops the attachment being read by whoever
 * the email is forwarded to; it would not stop someone determined who had
 * both the file and time.
 */
class CredentialSheetController extends Controller
{
    /** Downloaded by the person at the dashboard. */
    public function download(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer'],
            'protect' => ['required', 'boolean'],
        ]);

        $credentials = $this->pick($client, $data['ids']);
        $password = $data['protect'] ? $this->password() : null;

        return response()->json([
            'data' => [
                'filename' => $this->filename($client),
                // Base64 in JSON rather than a raw PDF response, so the
                // password can travel in the same answer without a custom
                // header that CORS would have to be told about.
                'pdf' => base64_encode($this->render($client, $credentials, $password)),
                'password' => $password,
            ],
        ]);
    }

    /** Emailed to the client, protected unless told otherwise. */
    public function send(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer'],
            // Defaults to the client's own address; can be the person you
            // actually deal with instead.
            'to' => ['nullable', 'email:rfc', 'max:190'],
            'note' => ['nullable', 'string', 'max:1000'],
            // Protected when not said: the safe choice is the default one.
            'protect' => ['sometimes', 'boolean'],
        ]);

        $to = $data['to'] ?? $client->email;

        if (! $to) {
            throw ValidationException::withMessages([
                'to' => 'This client has no email address. Add one, or type where to send it.',
            ]);
        }

        $credentials = $this->pick($client, $data['ids']);

        $password = ($data['protect'] ?? true) ? $this->password() : null;

        /*
         * A refused send is reported, not thrown: a bare 500 told the
         * person nothing, and the reason — an unverified domain, a key
         * without sending rights — is the one thing they need to fix it.
         */
        try {
            Mail::to($to)->send(new ClientLoginsMail(
                client: $client,
                pdf: $this->render($client, $credentials, $password),
                filename: $this->filename($client),
                count: $credentials->count(),
                note: $data['note'] ?? null,
                protected: $password !== null,
            ));
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'The email service refused it: '.Str::limit($e->getMessage(), 240)
                    .' Nothing was sent.',
            ], 502);
        }

        return response()->json([
            'data' => [
                'sent_to' => $to,
                'count' => $credentials->count(),
                'password' => $password,
            ],
        ]);
    }

    /**
     * Sent to the client on WhatsApp, protected unless told otherwise. The
     * password comes back here, as with email, to be given another way —
     * never in the same chat as the file. An open sheet goes under its own
     * template, whose words do not promise a password that is not there.
     */
    public function whatsapp(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['integer'],
            'to' => ['nullable', 'string', 'max:30'],
            'protect' => ['sometimes', 'boolean'],
        ]);

        $to = ClientMessenger::number($data['to'] ?? null, $client->phone);
        $credentials = $this->pick($client, $data['ids']);
        $password = ($data['protect'] ?? true) ? $this->password() : null;

        // "vos 3 accès (Hébergement, WordPress, Google)" — enough to know
        // what the file is without opening it.
        $labels = Str::limit($credentials->pluck('label')->implode(', '), 120);
        $count = $credentials->count();
        $what = ($count === 1 ? 'votre accès' : "vos {$count} accès")." ({$labels})";

        try {
            ClientMessenger::make()->send(
                $password !== null ? 'logins' : 'logins_open',
                $to,
                [$client->contact_name ?: $client->name, $what],
                $this->render($client, $credentials, $password),
                $this->filename($client),
            );
        } catch (\RuntimeException $e) {
            report($e);

            return response()->json([
                'message' => Str::limit($e->getMessage(), 300).' Nothing was sent.',
            ], 502);
        }

        return response()->json([
            'data' => [
                'sent_to' => $to,
                'count' => $count,
                'password' => $password,
            ],
        ]);
    }

    /**
     * The selected logins, and only this client's: an id belonging to
     * someone else is refused, not quietly dropped, because a sheet
     * silently missing a line is the kind of wrong nobody notices.
     *
     * @param  array<int, int>  $ids
     * @return Collection<int, Credential>
     */
    private function pick(Client $client, array $ids): Collection
    {
        $credentials = $client->credentials()
            ->whereIn('id', $ids)
            ->with('engagement:id,title')
            ->get();

        if ($credentials->count() !== count(array_unique($ids))) {
            throw ValidationException::withMessages([
                'ids' => 'Some of those logins do not belong to this client.',
            ]);
        }

        return $credentials;
    }

    /** @param  Collection<int, Credential>  $credentials */
    private function render(Client $client, Collection $credentials, ?string $password): string
    {
        $pdf = Pdf::loadView('credentials.sheet', [
            'client' => $client,
            'credentials' => $credentials,
            'from' => BillingProfile::current(),
        ])
            ->setPaper('a4')
            // Only the glyphs actually used: the whole of DejaVu Sans made a
            // one-page sheet weigh a megabyte, too heavy to email.
            ->setOption('isFontSubsettingEnabled', true);

        $dompdf = $pdf->getDomPDF();
        $dompdf->render();

        if ($password !== null) {
            /*
             * The user password opens it; the owner password — random and
             * thrown away — is what would be needed to lift the
             * restrictions, so nobody holds it.
             */
            $dompdf->getCanvas()->get_cpdf()->setEncryption(
                $password,
                Str::random(32),
                ['print'],
            );
        }

        return $dompdf->output();
    }

    /**
     * Something that can be read out over the phone: no 0/O, no 1/l/I, in
     * groups of four.
     */
    private function password(): string
    {
        $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
        $out = '';

        for ($i = 0; $i < 12; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return implode('-', str_split($out, 4));
    }

    private function filename(Client $client): string
    {
        return 'acces-'.(Str::slug($client->name) ?: 'client').'.pdf';
    }
}
