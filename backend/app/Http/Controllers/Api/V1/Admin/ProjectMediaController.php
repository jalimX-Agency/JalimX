<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\MediaResource;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * The dashboard's view of projects and their images.
 *
 * Separate from the public ProjectController because the dashboard needs what
 * the public site must never see: projects that are not published yet. Every
 * route here sits behind auth:sanctum.
 *
 * Images attach to a project's media collections rather than to a free-floating
 * library. A picture on this site always belongs to one case study, and
 * attaching it there means deleting a project cannot strand its files.
 */
class ProjectMediaController extends Controller
{
    private const COLLECTIONS = ['cover', 'gallery', 'dashboard'];

    public function index(): JsonResponse
    {
        $projects = Project::query()->with('media')->ordered()->get();

        return response()->json([
            'data' => $projects->map(fn (Project $project) => $this->summary($project)),
        ]);
    }

    public function show(Project $project): JsonResponse
    {
        $project->load('media');

        return response()->json(['data' => $this->detail($project)]);
    }

    public function store(Request $request, Project $project): JsonResponse
    {
        $data = $request->validate([
            'collection' => ['required', Rule::in(self::COLLECTIONS)],
            /*
             * Checked by content, not by the name the browser sent: `image`
             * and `mimes` both sniff the file itself, so a script renamed to
             * .jpg is refused. No SVG — it can carry script, and it would be
             * served from our own CDN domain.
             */
            'file' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp,avif', 'max:10240'],
            'alt' => ['nullable', 'string', 'max:200'],
        ]);

        $file = $data['file'];

        // Stored with the image so the site can reserve the right space before
        // it loads, instead of the page jumping when it arrives.
        [$width, $height] = @getimagesize($file->getRealPath()) ?: [null, null];

        // The client's filename is only a hint for a readable URL. The
        // extension comes from the detected type, never from the upload.
        $base = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: $data['collection'];

        $media = $project
            ->addMedia($file)
            ->usingName($base)
            ->usingFileName($base.'-'.Str::lower(Str::random(6)).'.'.$file->extension())
            ->withCustomProperties([
                'alt' => $data['alt'] ?? "{$project->client_name} — {$data['collection']}",
                'width' => $width,
                'height' => $height,
            ])
            ->toMediaCollection($data['collection']);

        // Media rows are not the project row, so saving them fires nothing on
        // the project. Touching it is what tells the public site to rebuild.
        $project->touch();

        return response()->json(['data' => MediaResource::make($media)], 201);
    }

    public function destroy(Media $media): JsonResponse
    {
        // Only images that belong to a project are ours to remove from here.
        abort_unless($media->model_type === Project::class, 404);

        $project = $media->model;
        $media->delete();
        $project?->touch();

        return response()->json(['data' => null]);
    }

    /** @return array<string, mixed> */
    private function summary(Project $project): array
    {
        return [
            'slug' => $project->slug,
            'client_name' => $project->client_name,
            'title' => $this->pair($project, 'title'),
            'year' => $project->year,
            'is_published' => $project->is_published,
            'is_featured' => $project->is_featured,
            'cover' => MediaResource::make($project->getFirstMedia('cover')),
            'counts' => [
                'gallery' => $project->getMedia('gallery')->count(),
                'dashboard' => $project->getMedia('dashboard')->count(),
            ],
        ];
    }

    /** @return array{en: string, fr: string} */
    private function pair(Project $project, string $field): array
    {
        $stored = $project->getTranslations($field);

        return ['en' => (string) ($stored['en'] ?? ''), 'fr' => (string) ($stored['fr'] ?? '')];
    }

    /** @return array<string, mixed> */
    private function detail(Project $project): array
    {
        return [
            ...$this->summary($project),
            'project_url' => $project->project_url,
            'position' => $project->position,
            'is_live' => $project->published_at !== null,
            'summary' => $this->pair($project, 'summary'),
            'challenge' => $this->pair($project, 'challenge'),
            'solution' => $this->pair($project, 'solution'),
            'outcome' => $this->pair($project, 'outcome'),
            'tags' => array_values($project->tags ?? []),
            'metrics' => array_map(fn ($m) => [
                'value' => (string) ($m['value'] ?? ''),
                'label' => ['en' => (string) ($m['label']['en'] ?? ''), 'fr' => (string) ($m['label']['fr'] ?? '')],
            ], $project->metrics ?? []),
            'gallery' => MediaResource::collection($project->getMedia('gallery')),
            'dashboard' => MediaResource::collection($project->getMedia('dashboard')),
        ];
    }
}
