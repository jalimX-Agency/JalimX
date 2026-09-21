<?php

namespace App\Http\Resources;

use App\Models\Engagement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A piece of work for a client, as the dashboard sees it.
 *
 * @mixin Engagement
 */
class EngagementResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'client_id' => $this->client_id,
            'title' => (string) $this->title,
            'status' => (string) $this->status,
            'billing' => (string) $this->billing,
            // A string, not a float: money read back as a float is money one
            // rounding away from disagreeing with the invoice.
            'budget' => $this->budget !== null ? (string) $this->budget : null,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
            'description' => $this->description,
            'work_types' => $this->whenLoaded('workTypes', fn () => $this->workTypes
                ->map(fn ($t) => [
                    'id' => $t->id,
                    'name' => (string) $t->name,
                    'needs_logins' => (bool) $t->needs_logins,
                ])->values()),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'kind' => (string) $a->kind,
                    'name' => (string) $a->name,
                    'size' => (int) $a->size,
                    'viewable' => in_array((string) $a->mime, [
                        'application/pdf',
                        'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic',
                    ], true),
                    'created_at' => $a->created_at?->toIso8601String(),
                ])->values()),
            'case_study_id' => $this->case_study_id,
            'case_study' => $this->whenLoaded('caseStudy', fn () => $this->caseStudy ? [
                'slug' => (string) $this->caseStudy->slug,
                'title' => (string) $this->caseStudy->getTranslation('title', 'en'),
                'is_published' => (bool) $this->caseStudy->is_published,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
