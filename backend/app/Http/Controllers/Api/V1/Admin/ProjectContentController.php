<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Writing a case study's words: creating a project and editing its text.
 *
 * Images stay in ProjectMediaController. Saving goes through the model, so
 * the RevalidatesSite observer rebuilds the public pages on its own.
 */
class ProjectContentController extends Controller
{
    private const TEXT = ['title', 'summary', 'challenge', 'solution', 'outcome'];

    /** A new project starts hidden, with just enough to name it. */
    public function store(Request $request, ProjectMediaController $media): JsonResponse
    {
        $data = $request->validate([
            'client_name' => ['required', 'string', 'max:120'],
            'title_en' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/'],
        ]);

        $slug = ($data['slug'] ?? null) ?: Str::slug($data['client_name']);

        validator(['slug' => $slug], [
            'slug' => ['required', Rule::unique('projects', 'slug')],
        ], [
            'slug.required' => 'The client name needs at least one letter or number.',
            'slug.unique' => 'Another project already uses this address.',
        ])->validate();

        $project = Project::create([
            'slug' => $slug,
            'client_name' => $data['client_name'],
            'title' => ['en' => $data['title_en']],
            'position' => (int) Project::max('position') + 1,
            'is_published' => false,
            'is_featured' => false,
        ]);

        return $media->show($project)->setStatusCode(201);
    }

    public function update(Request $request, Project $project, ProjectMediaController $media): JsonResponse
    {
        $rules = [
            'client_name' => ['required', 'string', 'max:120'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:'.(now()->year + 1)],
            'project_url' => ['nullable', 'url:https,http', 'max:255'],
            'position' => ['required', 'integer', 'min:0', 'max:999'],
            'is_published' => ['required', 'boolean'],
            'is_featured' => ['required', 'boolean'],
            'tags' => ['present', 'array', 'max:6'],
            'tags.*' => ['string', 'max:24'],
            'metrics' => ['present', 'array', 'max:4'],
            'metrics.*.value' => ['required', 'string', 'max:12'],
            'metrics.*.label.en' => ['required', 'string', 'max:60'],
            'metrics.*.label.fr' => ['required', 'string', 'max:60'],
            /*
             * The address of a live case study is in the sitemap, in shared
             * links and in Google. It can change while the project is hidden,
             * and is locked once it has been published.
             */
            'slug' => [
                'required', 'string', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                Rule::unique('projects', 'slug')->ignore($project->id),
                function ($attribute, $value, $fail) use ($project) {
                    if ($project->published_at !== null && $value !== $project->slug) {
                        $fail('The address is locked once a project has been published.');
                    }
                },
            ],
        ];

        foreach (self::TEXT as $field) {
            $max = $field === 'title' ? 160 : 1200;
            $rules["{$field}.en"] = [$field === 'title' ? 'required' : 'nullable', 'string', "max:{$max}"];
            $rules["{$field}.fr"] = ['nullable', 'string', "max:{$max}"];
        }

        $validator = validator($request->all(), $rules, [
            'metrics.*.value.required' => 'Every metric needs a figure.',
            'metrics.*.label.*.required' => 'Every metric needs a label in both languages.',
        ]);

        /*
         * A published page renders in both languages, so it cannot go live
         * with half of its headline missing.
         */
        $validator->after(function (Validator $v) use ($request) {
            if (! $request->boolean('is_published')) {
                return;
            }
            foreach (['title', 'summary'] as $field) {
                foreach (['en', 'fr'] as $locale) {
                    if (trim((string) $request->input("{$field}.{$locale}")) === '') {
                        $v->errors()->add("{$field}.{$locale}", 'Needed in both languages before the project can be published.');
                    }
                }
            }
        });

        $data = $validator->validate();

        foreach (self::TEXT as $field) {
            // Empty strings are dropped, so a missing translation stays missing
            // rather than being stored as "". Replaced, not merged: filling a
            // translatable attribute keeps locales absent from the input, and
            // a French text someone cleared would quietly survive.
            $project->replaceTranslations($field, array_filter(
                array_map(fn ($s) => trim((string) $s), $data[$field] ?? []),
                fn ($s) => $s !== '',
            ));
            unset($data[$field]);
        }

        $data['tags'] = array_values(array_unique(array_filter(
            array_map(fn ($t) => Str::lower(trim($t)), $data['tags']),
        )));
        // Rebuilt field by field: only these keys are stored, in the shape the
        // seeders wrote, whatever else the request carried.
        $data['metrics'] = array_map(fn ($m) => [
            'label' => ['en' => trim($m['label']['en']), 'fr' => trim($m['label']['fr'])],
            'value' => trim($m['value']),
        ], array_values($data['metrics'])) ?: null;
        // Featured means "on the homepage", which a hidden project cannot be.
        $data['is_featured'] = $data['is_featured'] && $data['is_published'];

        if ($data['is_published'] && $project->published_at === null) {
            $data['published_at'] = now();
        }

        $project->fill($data)->save();

        return $media->show($project->fresh());
    }
}
