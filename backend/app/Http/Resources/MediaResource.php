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
            // The id is what the dashboard deletes by; harmless in public.
            'id' => $this->id,
            'url' => $this->getFullUrl(),
            'name' => $this->name,
            /*
             * Cast explicitly. getCustomProperty() returns mixed, which the
             * OpenAPI generator could only describe as an empty object — and
             * that is what the frontend's types then said a width was.
             */
            'alt' => $this->hasCustomProperty('alt') ? (string) $this->getCustomProperty('alt') : null,
            'width' => $this->hasCustomProperty('width') ? (int) $this->getCustomProperty('width') : null,
            'height' => $this->hasCustomProperty('height') ? (int) $this->getCustomProperty('height') : null,
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
