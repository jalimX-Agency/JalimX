<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\SerialisesContent;
use App\Models\Testimonial;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Testimonial */
class TestimonialResource extends JsonResource
{
    use SerialisesContent;

    public function toArray(Request $request): array
    {
        return [
            'id' => (int) $this->id,
            'author_name' => (string) $this->author_name,
            'author_role' => $this->author_role,
            'client_name' => $this->client_name,
            'quote' => $this->tr('quote'),
            'avatar' => MediaResource::make($this->getFirstMedia('avatar')),
            'project_slug' => $this->whenLoaded('project', fn () => $this->project?->slug),
        ];
    }
}
