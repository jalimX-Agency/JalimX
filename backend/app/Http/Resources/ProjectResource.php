<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\SerialisesContent;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Project */
class ProjectResource extends JsonResource
{
    use SerialisesContent;

    public function toArray(Request $request): array
    {
        return [
            'slug' => (string) $this->slug,
            'client_name' => (string) $this->client_name,
            'year' => $this->year,
            'project_url' => $this->project_url,
            'is_featured' => (bool) $this->is_featured,

            'title' => $this->tr('title'),
            'summary' => $this->tr('summary'),
            'challenge' => $this->tr('challenge'),
            'solution' => $this->tr('solution'),
            'outcome' => $this->tr('outcome'),

            'tags' => $this->strings($this->tags),
            'stack' => $this->strings($this->stack),
            'metrics' => $this->metricList($this->metrics),

            'cover' => MediaResource::make($this->getFirstMedia('cover')),
            'gallery' => MediaResource::collection($this->getMedia('gallery')),
            'dashboard' => MediaResource::collection($this->getMedia('dashboard')),

            'testimonials' => TestimonialResource::collection(
                $this->whenLoaded('testimonials')
            ),

            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
