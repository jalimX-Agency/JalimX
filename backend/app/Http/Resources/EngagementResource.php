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
            // A string, not a float: money read back as a float is money one
            // rounding away from disagreeing with the invoice.
            'budget' => $this->budget !== null ? (string) $this->budget : null,
            'starts_on' => $this->starts_on?->toDateString(),
            'ends_on' => $this->ends_on?->toDateString(),
            'description' => $this->description,
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
