<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\EngagementResource;
use App\Models\Client;
use App\Models\Engagement;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The work done for a client.
 *
 * Every route here hangs off a client or off one piece of work: there is
 * no "all work" screen, because the question is always "what are we doing
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
            'billing' => ['required', Rule::in(Engagement::BILLINGS)],
            /*
             * For a one-off this is the whole price; for a retainer it is
             * what is charged each month. One column, because it answers
             * the same question in both cases: what does this cost.
             */
            'budget' => ['nullable', 'numeric', 'min:0', 'max:99999999.99'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'description' => ['nullable', 'string', 'max:5000'],
            'work_type_ids' => ['present', 'array', 'max:10'],
            'work_type_ids.*' => ['integer', Rule::exists('work_types', 'id')],
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
            'work_type_ids' => 'kinds of work',
            'description' => 'what it covers',
        ];
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate($this->rules(), [], $this->names());

        $engagement = DB::transaction(function () use ($client, $data) {
            $engagement = $client->engagements()->create($data);
            $engagement->workTypes()->sync($data['work_type_ids']);

            return $engagement;
        });

        return response()->json(
            ['data' => new EngagementResource($this->loaded($engagement))],
            201,
        );
    }

    public function update(Request $request, Engagement $engagement): EngagementResource
    {
        $data = $request->validate($this->rules(), [], $this->names());

        DB::transaction(function () use ($engagement, $data) {
            $engagement->update($data);
            $engagement->workTypes()->sync($data['work_type_ids']);
        });

        return new EngagementResource($this->loaded($engagement->fresh()));
    }

    public function destroy(Engagement $engagement): JsonResponse
    {
        if ($engagement->documents()->exists()) {
            return response()->json([
                'message' => 'This work has been quoted or invoiced. Mark it cancelled instead — the paperwork has to stay.',
            ], 409);
        }

        $engagement->delete();

        return response()->json(null, 204);
    }

    /**
     * Start the public page about this work.
     *
     * The link runs this way round on purpose: a case study is written
     * about work that happened, so it is created from the work and arrives
     * already knowing the client, the name and the year. The other
     * direction — picking a case study from a dropdown while setting up a
     * job — described something that does not exist yet.
     */
    public function createCaseStudy(Engagement $engagement): JsonResponse
    {
        $engagement->load('client', 'caseStudy');

        if ($engagement->caseStudy) {
            return response()->json([
                'data' => new EngagementResource($this->loaded($engagement)),
            ]);
        }

        $client = $engagement->client;
        $base = Str::slug($client->name) ?: 'case-study';
        $slug = $base;

        for ($n = 2; Project::where('slug', $slug)->exists(); $n++) {
            $slug = "$base-$n";
        }

        $project = Project::create([
            'slug' => $slug,
            'client_name' => $client->name,
            'title' => ['en' => $engagement->title],
            // The year it finished, or the year it started, or this one.
            'year' => ($engagement->ends_on ?? $engagement->starts_on ?? now())->year,
            'position' => (int) Project::max('position') + 1,
            // Hidden until it is written. Publishing is a separate decision,
            // made on the case study's own page.
            'is_published' => false,
            'is_featured' => false,
        ]);

        $engagement->case_study_id = $project->id;
        $engagement->save();

        return response()->json([
            'data' => new EngagementResource($this->loaded($engagement->fresh())),
        ], 201);
    }

    private function loaded(Engagement $engagement): Engagement
    {
        return $engagement->load('caseStudy', 'workTypes', 'attachments', 'tasks.reminders');
    }
}
