<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * The agency's clients.
 */
class ClientController extends Controller
{
    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'legal_name' => ['nullable', 'string', 'max:160'],
            // Morocco's ICE is 15 digits. Loose enough for a foreign client's
            // equivalent, strict enough to catch a pasted phone number.
            'ice' => ['nullable', 'string', 'max:20', 'regex:/^[0-9A-Za-z\-\/ ]*$/'],
            'contact_name' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email:rfc', 'max:190'],
            'phone' => ['nullable', 'string', 'max:40', 'regex:/^[0-9+()\s.-]*$/'],
            'website' => ['nullable', 'url:https,http', 'max:190'],
            'address' => ['nullable', 'string', 'max:190'],
            'city' => ['nullable', 'string', 'max:80'],
            'country' => ['required', 'string', 'max:80'],
            'currency' => ['required', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate(['q' => ['nullable', 'string', 'max:120']]);

        $clients = Client::query()
            ->withCount('engagements')
            ->when($validated['q'] ?? null, function ($query, $term) {
                // ILIKE: Postgres LIKE is case-sensitive, and nobody types a
                // client's name with the capitals it was saved with.
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where(fn ($w) => $w
                    ->where('name', 'ilike', $like)
                    ->orWhere('legal_name', 'ilike', $like)
                    ->orWhere('contact_name', 'ilike', $like)
                    ->orWhere('email', 'ilike', $like)
                    ->orWhere('city', 'ilike', $like));
            })
            ->orderBy('name')
            ->paginate(50)
            ->withQueryString();

        return ClientResource::collection($clients);
    }

    public function store(Request $request): JsonResponse
    {
        $client = Client::create($request->validate($this->rules()));

        return response()->json(['data' => new ClientResource($client->refresh())], 201);
    }

    public function show(Client $client): ClientResource
    {
        return new ClientResource(
            $client->loadCount('engagements')->load(
                'engagements.caseStudy',
                'engagements.workTypes',
                'engagements.attachments',
                'documents.items',
                'documents.payments',
                'credentials',
            )
        );
    }

    public function update(Request $request, Client $client): ClientResource
    {
        $client->update($request->validate($this->rules()));

        return new ClientResource($client->fresh());
    }

    public function destroy(Client $client): JsonResponse
    {
        /*
         * Checked here rather than left to the foreign key, which would
         * answer a plain 500. An invoice is a record of money and outlives
         * the working relationship, so the client stays as long as it does.
         */
        if ($client->documents()->exists()) {
            return response()->json([
                'message' => 'This client has quotes or invoices. They have to stay, so the client does too.',
            ], 409);
        }

        $client->delete();

        return response()->json(null, 204);
    }

    /**
     * Turn an enquiry into a client, carrying over what the form already
     * asked for so the same details are not typed twice.
     *
     * Idempotent by lead: converting the same enquiry twice returns the
     * client already made from it rather than creating a duplicate.
     */
    public function convertLead(Lead $lead): JsonResponse
    {
        $existing = Client::where('lead_id', $lead->id)->first();

        if ($existing) {
            return response()->json(['data' => new ClientResource($existing)], 200);
        }

        $client = Client::create([
            // The company if they gave one, otherwise the person: a client
            // needs a name, and "Ahmed" is better than an empty row.
            'name' => $lead->company ?: $lead->name,
            'contact_name' => $lead->name,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'lead_id' => $lead->id,
        ]);

        /*
         * Refreshed before serialising: country and currency come from column
         * defaults, which the freshly built model has never read, so without
         * this the dashboard is handed empty strings for both — and saving
         * that form would write the blanks back over the real values.
         */
        return response()->json(['data' => new ClientResource($client->refresh())], 201);
    }
}
