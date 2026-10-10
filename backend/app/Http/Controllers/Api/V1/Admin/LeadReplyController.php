<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\AI\AIManager;
use App\AI\Exceptions\AiRequestFailed;
use App\AI\Exceptions\AiUnavailable;
use App\AI\Tasks\LeadReply as LeadReplyTask;
use App\Http\Controllers\Controller;
use App\Http\Resources\LeadResource;
use App\Mail\LeadReplyMail;
use App\Models\Lead;
use App\Models\Setting;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Throwable;

/**
 * Answering an enquiry by email from the dashboard, optionally with a
 * first draft from AI, and optionally with a button that opens WhatsApp on
 * the agency's number so the conversation can continue there.
 */
class LeadReplyController extends Controller
{
    /** A first draft. Nothing is sent: the person reads and edits it first. */
    public function draft(Request $request, Lead $lead, AIManager $ai): JsonResponse
    {
        $input = $request->validate([
            'tone' => ['nullable', Rule::in(LeadReplyTask::TONES)],
            'language' => ['nullable', Rule::in(['en', 'fr', 'ar'])],
            'instruction' => ['nullable', 'string', 'max:500'],
            'whatsapp' => ['sometimes', 'boolean'],
        ]);

        try {
            ['output' => $draft, 'result' => $result] = $ai->generate([
                'task' => 'lead_reply',
                'input' => [
                    'lead' => $lead->only(['name', 'company', 'service_interest', 'budget_range', 'message']),
                    'tone' => $input['tone'] ?? 'warm',
                    'language' => $input['language'] ?? (in_array($lead->locale, ['en', 'fr'], true) ? $lead->locale : 'en'),
                    'instruction' => $input['instruction'] ?? null,
                    'whatsapp' => (bool) ($input['whatsapp'] ?? false),
                    'signer' => $request->user()?->name ? Str::before($request->user()->name, ' ') : 'JalimX',
                ],
            ], $request->user()?->id);
        } catch (AiUnavailable $e) {
            return response()->json(['message' => $e->getMessage(), 'reasons' => $e->reasons], 503);
        } catch (AiRequestFailed $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => [
                'subject' => $draft['subject'],
                'body' => $draft['body'],
                'source' => $result->credentialLabel,
            ],
        ]);
    }

    public function send(Request $request, Lead $lead): LeadResource|JsonResponse
    {
        $data = $request->validate([
            // The lead's own address unless another one is typed.
            'to' => ['nullable', 'email:rfc', 'max:190'],
            'subject' => ['required', 'string', 'max:190'],
            'body' => ['required', 'string', 'min:5', 'max:8000'],
            'whatsapp' => ['sometimes', 'boolean'],
        ]);

        $to = $data['to'] ?? $lead->email;
        $withWhatsapp = (bool) ($data['whatsapp'] ?? false);

        $url = null;
        if ($withWhatsapp) {
            $number = self::agencyWhatsApp();
            if ($number === null) {
                return response()->json([
                    'message' => 'There is no WhatsApp number to link to. Add one in Settings → Site, or send without the button.',
                ], 422);
            }
            $url = self::whatsappUrl($number, $lead);
        }

        /*
         * A refused send is reported, not thrown, with the provider's own
         * reason: an unverified domain is the one thing to fix, and a bare
         * 500 says nothing.
         */
        try {
            Mail::to($to)->send(new LeadReplyMail($data['subject'], $data['body'], $lead->locale, $url));
        } catch (Throwable $e) {
            report($e);

            return response()->json([
                'message' => 'The email service refused it: '.Str::limit($e->getMessage(), 240).' Nothing was sent.',
            ], 502);
        }

        $lead->replies()->create([
            'user_id' => $request->user()?->id,
            'sent_to' => $to,
            'subject' => $data['subject'],
            'body' => $data['body'],
            'with_whatsapp' => $withWhatsapp,
        ]);

        // Answering is what "contacted" means; a later stage is left alone.
        $changes = ['read_at' => $lead->read_at ?? now()];
        if ($lead->status === 'new') {
            $changes['status'] = 'contacted';
        }
        $lead->forceFill($changes)->save();

        return new LeadResource($lead->load(['client', 'replies']));
    }

    /** The agency's first WhatsApp number from Settings, in digits. */
    public static function agencyWhatsApp(): ?string
    {
        $values = Setting::map()['contact_whatsapp']['values'] ?? [];

        foreach ((array) $values as $value) {
            $digits = PhoneNumber::forWhatsApp((string) $value);
            if ($digits !== null) {
                return $digits;
            }
        }

        return null;
    }

    /** wa.me link that opens a chat with the agency, first line written. */
    private static function whatsappUrl(string $number, Lead $lead): string
    {
        $text = $lead->locale === 'fr'
            ? "Bonjour JalimX, c'est {$lead->name}. Je vous écris suite à votre email."
            : "Hello JalimX, this is {$lead->name}. I am writing after your email.";

        return 'https://wa.me/'.$number.'?text='.rawurlencode($text);
    }
}
