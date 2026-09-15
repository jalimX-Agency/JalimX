<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\LeadResource;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * The inbox for the contact form.
 */
class LeadController extends Controller
{
    /**
     * Newest first, optionally narrowed to one status or a search.
     *
     * The counts ride along with every page so the status tabs stay honest
     * after a lead moves between them, without a second request.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $validated = $request->validate([
            'status' => ['nullable', Rule::in(Lead::STATUSES)],
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $leads = Lead::query()
            ->when($validated['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($validated['q'] ?? null, function ($q, $term) {
                // ILIKE: Postgres LIKE is case-sensitive, and nobody types an
                // email address with the capitals the sender used.
                $like = '%'.addcslashes($term, '%_\\').'%';
                $q->where(fn ($w) => $w
                    ->where('name', 'ilike', $like)
                    ->orWhere('email', 'ilike', $like)
                    ->orWhere('company', 'ilike', $like)
                    ->orWhere('phone', 'ilike', $like));
            })
            ->latest()
            ->paginate(30)
            ->withQueryString();

        $counts = Lead::query()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return LeadResource::collection($leads)->additional([
            'meta' => [
                'counts' => collect(Lead::STATUSES)
                    ->mapWithKeys(fn ($s) => [$s => (int) ($counts[$s] ?? 0)]),
                'unread' => Lead::whereNull('read_at')->count(),
            ],
        ]);
    }

    /** Opening a lead is what marks it read. */
    public function show(Lead $lead): LeadResource
    {
        if ($lead->read_at === null) {
            $lead->forceFill(['read_at' => now()])->save();
        }

        return new LeadResource($lead);
    }

    public function update(Request $request, Lead $lead): LeadResource
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::in(Lead::STATUSES)],
            'note' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'is_read' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_read', $validated)) {
            $lead->read_at = $validated['is_read'] ? ($lead->read_at ?? now()) : null;
            unset($validated['is_read']);
        }

        $lead->fill($validated)->save();

        return new LeadResource($lead);
    }

    /** For spam. A real enquiry that went nowhere is marked lost, not deleted. */
    public function destroy(Lead $lead): JsonResponse
    {
        $lead->delete();

        return response()->json(null, 204);
    }
}
