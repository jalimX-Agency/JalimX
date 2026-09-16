<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Editing the services' words, order and visibility.
 *
 * No creating or deleting from here: each service has its own icon and deep
 * link in the frontend, so a new one is a design change, not a form entry.
 */
class ServiceController extends Controller
{
    private const TEXT = ['title', 'tagline', 'body'];

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Service::query()->ordered()->get()->map(fn (Service $s) => $this->shape($s)),
        ]);
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $data = $request->validate([
            'is_published' => ['required', 'boolean'],
            'position' => ['required', 'integer', 'min:0', 'max:999'],
            'title.en' => ['required', 'string', 'max:60'],
            'title.fr' => ['required', 'string', 'max:60'],
            'tagline.en' => ['required', 'string', 'max:160'],
            'tagline.fr' => ['required', 'string', 'max:160'],
            'body.en' => ['nullable', 'string', 'max:1200'],
            'body.fr' => ['nullable', 'string', 'max:1200'],
        ]);

        foreach (self::TEXT as $field) {
            $service->replaceTranslations($field, array_filter(
                array_map(fn ($s) => trim((string) $s), $data[$field] ?? []),
                fn ($s) => $s !== '',
            ));
        }

        $service->fill([
            'is_published' => $data['is_published'],
            'position' => $data['position'],
        ])->save();

        return response()->json(['data' => $this->shape($service->fresh())]);
    }

    /** @return array<string, mixed> */
    private function shape(Service $service): array
    {
        $pair = function (string $field) use ($service): array {
            $stored = $service->getTranslations($field);

            return ['en' => (string) ($stored['en'] ?? ''), 'fr' => (string) ($stored['fr'] ?? '')];
        };

        return [
            'slug' => $service->slug,
            'position' => $service->position,
            'is_published' => $service->is_published,
            'title' => $pair('title'),
            'tagline' => $pair('tagline'),
            'body' => $pair('body'),
        ];
    }
}
