<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/** @mixin Media */
class MediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'url' => $this->getFullUrl(),
            'name' => $this->name,
            'alt' => $this->getCustomProperty('alt'),
            'width' => $this->getCustomProperty('width'),
            'height' => $this->getCustomProperty('height'),
        ];
    }

    /**
     * An empty single-file collection serialises to null rather than an empty
     * object, so the frontend can test `cover &&` instead of `cover?.url &&`.
     *
     * Signature stays variadic to match JsonResource::make().
     */
    public static function make(...$parameters)
    {
        return ($parameters[0] ?? null) === null
            ? null
            : parent::make(...$parameters);
    }
}
