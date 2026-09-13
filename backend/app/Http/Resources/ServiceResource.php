<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\SerialisesContent;
use App\Models\Service;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Service */
class ServiceResource extends JsonResource
{
    use SerialisesContent;

    /**
     * Every translation ships in one payload rather than one response per
     * locale: the site is EN+FR only, the strings are small, and it means a
     * single ISR cache entry serves both languages.
     */
    public function toArray(Request $request): array
    {
        return [
            'slug' => (string) $this->slug,
            'title' => $this->tr('title'),
            'tagline' => $this->tr('tagline'),
            'body' => $this->tr('body'),
            'icon' => $this->icon,
            'cover' => MediaResource::make($this->getFirstMedia('cover')),
        ];
    }
}
