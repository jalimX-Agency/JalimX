<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Client;
use App\Models\Document;
use App\Models\Engagement;
use App\Support\BillingProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Quotes and invoices, always opened from the client they belong to.
 *
 * The rule that shapes this controller: a draft is a piece of paper you are
 * still writing, an issued document is a piece of paper you have handed
 * over. Drafts can be edited and deleted; issued ones can only be paid or
 * cancelled, and they keep their number either way.
 */
class DocumentController extends Controller
{
    public function store(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(Document::TYPES)],
            'engagement_id' => [
                'nullable', 'integer',
                // Someone else's engagement on this client's invoice would be
                // a quiet data leak between two businesses.
                Rule::exists('engagements', 'id')->where('client_id', $client->id),
            ],
            // A 50/50 build is the usual arrangement, so the two halves are
            // one click rather than arithmetic done twice.
            'preset' => ['nullable', Rule::in(['deposit', 'balance', 'full'])],
        ]);

        $profile = BillingProfile::current();
        $engagement = isset($data['engagement_id'])
            ? Engagement::find($data['engagement_id'])
            : null;

        $document = DB::transaction(function () use ($client, $data, $engagement, $profile) {
            $document = $client->documents()->create([
                'type' => $data['type'],
                'engagement_id' => $engagement?->id,
                'status' => 'draft',
                'issue_date' => now()->toDateString(),
                'due_date' => $data['type'] === 'invoice'
                    ? now()->addDays(30)->toDateString()
                    : null,
                'currency' => $client->currency,
                'tva_rate' => $profile['tva_rate'],
                'subject' => $engagement?->title,
                'terms' => $profile['payment_terms'] ?: null,
            ]);

            $line = $this->presetLine($data['preset'] ?? null, $engagement);
            if ($line) {
                $document->items()->create($line);
            }

            return $document;
        });

        return response()->json([
            'data' => new DocumentResource($document->load('items', 'payments')),
        ], 201);
    }

    /**
     * The whole document, lines included: the editor holds one form, and
     * sending it a line at a time would let a half-saved invoice exist.
     */
    public function update(Request $request, Document $document): DocumentResource
    {
        $this->refuseUnlessDraft($document);

        $data = $request->validate([
            'engagement_id' => [
                'nullable', 'integer',
                Rule::exists('engagements', 'id')->where('client_id', $document->client_id),
            ],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'tva_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'subject' => ['nullable', 'string', 'max:190'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'terms' => ['nullable', 'string', 'max:2000'],
            'items' => ['present', 'array', 'max:60'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.quantity' => ['required', 'numeric', 'min:0', 'max:99999'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
        ], [], [
            'issue_date' => 'issue date',
            'due_date' => 'due date',
            'tva_rate' => 'VAT rate',
        ]);

        DB::transaction(function () use ($document, $data) {
            $document->update([
                'engagement_id' => $data['engagement_id'] ?? null,
                'issue_date' => $data['issue_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'tva_rate' => $data['tva_rate'],
                'subject' => $data['subject'] ?? null,
                'notes' => $data['notes'] ?? null,
                'terms' => $data['terms'] ?? null,
            ]);

            /*
             * Replaced wholesale rather than matched up by id. The lines of a
             * draft have no life of their own - nothing points at them - so
             * the simple thing is also the correct one.
             */
            $document->items()->delete();
            foreach (array_values($data['items']) as $position => $item) {
                $document->items()->create([
                    'position' => $position,
                    'description' => $item['description'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                ]);
            }
        });

        return new DocumentResource($document->fresh()->load('items', 'payments'));
    }

    /**
     * Hand it over: give it its number, freeze who it is from and to, and
     * stop it being editable.
     */
    public function issue(Document $document): DocumentResource
    {
        $this->refuseUnlessDraft($document);

        $document->load('items', 'client');

        if ($document->items->isEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Add at least one line before issuing this.',
            ]);
        }

        $client = $document->client;

        /*
         * All of it or none of it. Issuing is three writes - the status, the
         * frozen details, the number - and a document left sent without a
         * number is the one state nothing downstream knows how to read.
         */
        DB::transaction(function () use ($document, $client) {
            $document->fill([
                'status' => 'sent',
                'issue_date' => $document->issue_date ?? now()->toDateString(),
            ]);

            $document->bill_to = [
                'name' => $client->legal_name ?: $client->name,
                'contact_name' => $client->contact_name,
                'address' => $client->address,
                'city' => $client->city,
                'country' => $client->country,
                'ice' => $client->ice,
                'email' => $client->email,
            ];
            $document->issued_by = BillingProfile::current();
            $document->save();

            $document->assignNumber();
        });

        return new DocumentResource($document->fresh()->load('items', 'payments'));
    }

    /** Accepted, declined or cancelled — the states that follow issuing. */
    public function status(Request $request, Document $document): DocumentResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['sent', 'accepted', 'declined', 'cancelled'])],
        ]);

        if ($document->status === 'draft') {
            throw ValidationException::withMessages([
                'status' => 'Issue this first.',
            ]);
        }

        $document->update(['status' => $data['status']]);

        return new DocumentResource($document->fresh()->load('items', 'payments'));
    }

    /**
     * Only drafts. An issued invoice is cancelled, never deleted: the
     * sequence has to stay whole, and a missing number is a question you
     * cannot answer a year later.
     */
    public function destroy(Document $document): JsonResponse
    {
        $this->refuseUnlessDraft($document);

        $document->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed>|null */
    private function presetLine(?string $preset, ?Engagement $engagement): ?array
    {
        if ($preset === null || $engagement === null || $engagement->budget === null) {
            return null;
        }

        $budget = (int) round((float) $engagement->budget * 100);

        return match ($preset) {
            'deposit' => [
                'position' => 0,
                'description' => "Deposit — 50% of {$engagement->title}",
                'quantity' => 1,
                // Halved in centimes so an odd budget splits exactly, with
                // the stray centime landing on the balance rather than
                // vanishing between the two invoices.
                'unit_price' => intdiv($budget, 2) / 100,
            ],
            'balance' => [
                'position' => 0,
                'description' => "Balance — 50% of {$engagement->title}",
                'quantity' => 1,
                'unit_price' => ($budget - intdiv($budget, 2)) / 100,
            ],
            'full' => [
                'position' => 0,
                'description' => $engagement->title,
                'quantity' => 1,
                'unit_price' => $budget / 100,
            ],
            default => null,
        };
    }

    private function refuseUnlessDraft(Document $document): void
    {
        if ($document->isEditable()) {
            return;
        }

        throw ValidationException::withMessages([
            'status' => 'This has been issued. Cancel it and write a new one instead.',
        ]);
    }
}
