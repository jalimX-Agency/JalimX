<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProjectController extends Controller
{
    /**
     * Published case studies.
     *
     * @param  Request  $request  `?featured=1` limits to the homepage picks,
     *                            `?tag=web` filters by tag.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $projects = Project::query()
            ->published()
            ->when($request->boolean('featured'), fn ($q) => $q->featured())
            ->when($request->string('tag')->toString(), function ($q, string $tag) {
                // tags is a JSON array column; whereJsonContains keeps it indexable
                return $q->whereJsonContains('tags', $tag);
            })
            ->ordered()
            ->get();

        return ProjectResource::collection($projects);
    }

    public function show(Project $project): ProjectResource
    {
        abort_unless($project->is_published, 404);

        return ProjectResource::make(
            $project->load(['testimonials' => fn ($q) => $q->published()->ordered()])
        );
    }
}
