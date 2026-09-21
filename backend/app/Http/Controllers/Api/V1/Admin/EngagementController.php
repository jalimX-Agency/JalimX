<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EngagementResource;
use App\Models\Client;
use App\Models\Engagement;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The work done for a client.
 *
 * Every route here hangs off a client or off one engagement: there is no
 * "all projects" screen, because the question is always "what are we doing
 * for them", never "what are we doing, in a list, for everyone".
 */
class EngagementController extends Controller
{
    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'status' => ['required', Rule::in(Engagement::STATUSES)],
            // Kept as a string through validation so 12000.50 is checked as
            // written rather than after a float has had its say.
            'budget' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'description' => ['nullable', 'string', 'max:5000'],
            'case_study_id' => ['nullable', 'integer', Rule::exists('projects', 'id')],
        ];
    }

    /**
     * Field names as they read in the form, so a rejected date says "end
     * date" rather than "ends on".
     *
     * @return array<string, string>
     */
    private function names(): array
    {
        return [
            'title' => 'name',
            'starts_on' => 'start date',
            'ends_on' => 'end date',
            'case_study_id' => 'case study',
            'description' => 'what it covers',
        ];
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $engagement = $client->engagements()->create(
            $request->validate($this->rules(), [], $this->names())
        );

        return response()->json(
            ['data' => new EngagementResource($engagement->refresh()->load('caseStudy'))],
            201,
        );
    }

    public function update(Request $request, Engagement $engagement): EngagementResource
    {
        $engagement->update($request->validate($this->rules(), [], $this->names()));

        return new EngagementResource($engagement->fresh()->load('caseStudy'));
    }

    public function destroy(Engagement $engagement): JsonResponse
    {
        $engagement->delete();

        return response()->json(null, 204);
    }

    /**
     * The case studies an engagement can be linked to. Slim on purpose: the
     * picker needs a name and an id, not five translated paragraphs.
     */
    public function caseStudyOptions(): JsonResponse
    {
        $options = Project::query()
            ->orderBy('position')
            ->get(['id', 'slug', 'title', 'is_published'])
            ->map(fn (Project $p) => [
                'id' => $p->id,
                'slug' => (string) $p->slug,
                'title' => (string) $p->getTranslation('title', 'en'),
                'is_published' => (bool) $p->is_published,
            ]);

        return response()->json(['data' => $options]);
    }
}
