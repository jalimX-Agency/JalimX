<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Credential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A client's logins.
 *
 * Two rules run through this controller. The secret is never in a list:
 * loading a client would otherwise put every one of their passwords into a
 * response, a browser cache and a devtools tab, all to draw a row of dots.
 * And the secret is never overwritten by silence: an edit that leaves the
 * field alone keeps what is stored, so saving a label cannot quietly wipe
 * a password.
 */
class CredentialController extends Controller
{
    public function store(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate($this->rules($client));

        $credential = $client->credentials()->create($data);

        return response()->json(['data' => $this->shape($credential)], 201);
    }

    public function update(Request $request, Credential $credential): JsonResponse
    {
        $data = $request->validate($this->rules($credential->client));

        /*
         * Absent means unchanged; an empty string means "clear it". The
         * dashboard sends nothing at all unless the person typed a new one.
         */
        if (! $request->has('secret')) {
            unset($data['secret']);
        }
        if (! $request->has('notes')) {
            unset($data['notes']);
        }

        $credential->update($data);

        return response()->json(['data' => $this->shape($credential->fresh())]);
    }

    /** The one route that hands the secret over, asked for one at a time. */
    public function reveal(Credential $credential): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $credential->id,
                'secret' => (string) $credential->secret,
                'notes' => (string) $credential->notes,
            ],
        ]);
    }

    public function destroy(Credential $credential): JsonResponse
    {
        $credential->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function rules(Client $client): array
    {
        return [
            'label' => ['required', 'string', 'max:120'],
            'engagement_id' => [
                'nullable', 'integer',
                Rule::exists('engagements', 'id')->where('client_id', $client->id),
            ],
            'url' => ['nullable', 'string', 'max:190'],
            'username' => ['nullable', 'string', 'max:190'],
            'secret' => ['sometimes', 'nullable', 'string', 'max:500'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }

    /** @return array<string, mixed> */
    private function shape(Credential $credential): array
    {
        return [
            'id' => $credential->id,
            'client_id' => $credential->client_id,
            'engagement_id' => $credential->engagement_id,
            'label' => (string) $credential->label,
            'url' => $credential->url,
            'username' => $credential->username,
            // Whether there is one, never what it is.
            'has_secret' => filled($credential->secret),
            'has_notes' => filled($credential->notes),
            'updated_at' => $credential->updated_at?->toIso8601String(),
        ];
    }
}
