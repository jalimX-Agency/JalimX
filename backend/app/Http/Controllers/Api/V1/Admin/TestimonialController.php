<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\Testimonial;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Validator;

/**
 * The dashboard's side of the client quotes.
 *
 * The public site shows them on the homepage and under the case study they
 * belong to; until now nothing here could add, edit or hide one. Saving goes
 * through the model, so the RevalidatesSite observer refreshes both places.
 *
 * Every quote is approved in writing by the person named — see
 * docs/collecting-testimonials.md — so a new one starts hidden.
 */
class TestimonialController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Testimonial::query()->ordered()->with('project')->get()
                ->map(fn (Testimonial $t) => $this->shape($t)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $testimonial = new Testimonial(['is_published' => false, 'position' => (int) Testimonial::max('position') + 1]);

        return $this->save($request, $testimonial, 201);
    }

    public function update(Request $request, Testimonial $testimonial): JsonResponse
    {
        return $this->save($request, $testimonial);
    }

    public function destroy(Testimonial $testimonial): JsonResponse
    {
        $testimonial->delete();

        return response()->json(['data' => null]);
    }

    private function save(Request $request, Testimonial $testimonial, int $status = 200): JsonResponse
    {
        $validator = validator($request->all(), [
            'author_name' => ['required', 'string', 'max:120'],
            'author_role' => ['nullable', 'string', 'max:120'],
            'client_name' => ['nullable', 'string', 'max:120'],
            'project_slug' => ['nullable', 'string', 'exists:projects,slug'],
            'position' => ['required', 'integer', 'min:0', 'max:999'],
            'is_published' => ['required', 'boolean'],
            'quote.en' => ['nullable', 'string', 'max:600'],
            'quote.fr' => ['nullable', 'string', 'max:600'],
        ]);

        // A published quote renders in both languages, so it cannot go live
        // with one of them missing.
        $validator->after(function (Validator $v) use ($request) {
            if (! $request->boolean('is_published')) {
                return;
            }
            foreach (['en', 'fr'] as $locale) {
                if (trim((string) $request->input("quote.{$locale}")) === '') {
                    $v->errors()->add("quote.{$locale}", 'Needed in both languages before the quote can be published.');
                }
            }
        });

        $data = $validator->validate();

        $testimonial->replaceTranslations('quote', array_filter(
            array_map(fn ($s) => trim((string) $s), $data['quote'] ?? []),
            fn ($s) => $s !== '',
        ));

        $testimonial->fill([
            'author_name' => trim($data['author_name']),
            'author_role' => ($data['author_role'] ?? null) ?: null,
            'client_name' => ($data['client_name'] ?? null) ?: null,
            'project_id' => ($data['project_slug'] ?? null)
                ? Project::where('slug', $data['project_slug'])->value('id')
                : null,
            'position' => $data['position'],
            'is_published' => $data['is_published'],
        ])->save();

        return response()->json(['data' => $this->shape($testimonial->fresh('project'))], $status);
    }

    /** @return array<string, mixed> */
    private function shape(Testimonial $t): array
    {
        $stored = $t->getTranslations('quote');

        return [
            'id' => $t->id,
            'author_name' => $t->author_name,
            'author_role' => $t->author_role,
            'client_name' => $t->client_name,
            'project_slug' => $t->project?->slug,
            'position' => $t->position,
            'is_published' => $t->is_published,
            'quote' => ['en' => (string) ($stored['en'] ?? ''), 'fr' => (string) ($stored['fr'] ?? '')],
        ];
    }
}
