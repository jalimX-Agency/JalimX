<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Engagement;
use App\Models\Task;
use App\Models\TaskTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Task templates: the steps a kind of job always takes, edited in
 * settings, used on a piece of work (or on their own), and made from the
 * tasks of a job that went well.
 */
class TaskTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => TaskTemplate::query()
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map(fn (TaskTemplate $t) => $this->shape($t)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $template = TaskTemplate::create([
            ...$this->clean($request->validate($this->rules())),
            'position' => (int) TaskTemplate::max('position') + 1,
        ]);

        return response()->json(['data' => $this->shape($template)], 201);
    }

    public function update(Request $request, TaskTemplate $taskTemplate): JsonResponse
    {
        $taskTemplate->update($this->clean($request->validate($this->rules())));

        return response()->json(['data' => $this->shape($taskTemplate->fresh())]);
    }

    /** Tasks already made from it stay; they are copies. */
    public function destroy(TaskTemplate $taskTemplate): JsonResponse
    {
        $taskTemplate->delete();

        return response()->json(null, 204);
    }

    /**
     * Turn the template into real tasks. Each step's day counts from the
     * start date, so the dates land where they would for this job.
     */
    public function apply(Request $request, TaskTemplate $taskTemplate): JsonResponse
    {
        $data = $request->validate([
            'engagement_id' => ['nullable', 'integer', 'exists:engagements,id'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'start_on' => ['nullable', 'date'],
            // Steps left out when it was used; indexes into the template.
            'skip' => ['sometimes', 'array'],
            'skip.*' => ['integer', 'min:0'],
        ]);

        $start = Carbon::parse($data['start_on'] ?? Carbon::today())->startOfDay();
        $engagementId = $data['engagement_id'] ?? null;
        // A work decides the client, the same as for a single task.
        $clientId = $engagementId
            ? Engagement::query()->whereKey($engagementId)->value('client_id')
            : ($data['client_id'] ?? null);
        $skip = array_flip($data['skip'] ?? []);

        $tasks = DB::transaction(function () use ($taskTemplate, $start, $engagementId, $clientId, $skip) {
            $position = (int) Task::query()->max('position');
            $made = [];

            foreach ($taskTemplate->items as $i => $item) {
                if (isset($skip[$i])) {
                    continue;
                }
                $checklist = array_map(fn ($text) => ['text' => $text, 'done' => false], $item['checklist'] ?? []);
                $made[] = Task::create([
                    'engagement_id' => $engagementId,
                    'client_id' => $clientId,
                    'title' => $item['title'],
                    'status' => 'todo',
                    'priority' => $item['priority'] ?? 'normal',
                    'progress' => 0,
                    'checklist' => $checklist ?: null,
                    'due_on' => isset($item['day']) ? $start->copy()->addDays((int) $item['day']) : null,
                    'position' => ++$position,
                ]);
            }

            return $made;
        });

        return response()->json([
            'data' => collect($tasks)
                ->map(fn (Task $t) => TaskController::shape($t->load(TaskController::WITH)))
                ->values(),
        ], 201);
    }

    /**
     * Save the tasks of a piece of work as a template: the job that went
     * well becomes how the next one starts. Days count from the work's
     * start date, or from its earliest task when it has none.
     */
    public function fromEngagement(Request $request, Engagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
        ]);

        $tasks = $engagement->tasks()->get();
        abort_if($tasks->isEmpty(), 422, 'This work has no tasks to save.');

        $base = $engagement->starts_on
            ?? $tasks->pluck('due_on')->filter()->min()
            ?? Carbon::today();

        $items = $tasks
            // Dated steps in date order, then the undated ones.
            ->sortBy(fn (Task $t) => [$t->due_on ? 0 : 1, $t->due_on?->timestamp ?? 0, $t->position, $t->id])
            ->map(fn (Task $t) => [
                'title' => (string) $t->title,
                'day' => $t->due_on ? max(0, (int) $base->copy()->startOfDay()->diffInDays($t->due_on, false)) : null,
                'priority' => (string) ($t->priority ?: 'normal'),
                'checklist' => collect($t->checklist ?? [])->pluck('text')->values()->all(),
            ])
            ->values()
            ->all();

        $template = TaskTemplate::create([
            'name' => $data['name'],
            'work_type_id' => $engagement->workTypes()->value('work_types.id'),
            'items' => $items,
            'position' => (int) TaskTemplate::max('position') + 1,
        ]);

        return response()->json(['data' => $this->shape($template)], 201);
    }

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'work_type_id' => ['nullable', 'integer', 'exists:work_types,id'],
            'items' => ['required', 'array', 'min:1', 'max:60'],
            'items.*.title' => ['required', 'string', 'max:190'],
            'items.*.day' => ['nullable', 'integer', 'between:0,365'],
            'items.*.priority' => ['required', Rule::in(Task::PRIORITIES)],
            'items.*.checklist' => ['sometimes', 'array', 'max:30'],
            'items.*.checklist.*' => ['string', 'max:190'],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function clean(array $data): array
    {
        $data['items'] = array_values(array_map(fn ($i) => [
            'title' => trim($i['title']),
            'day' => isset($i['day']) ? (int) $i['day'] : null,
            'priority' => $i['priority'],
            'checklist' => array_values(array_filter(array_map('trim', $i['checklist'] ?? []), 'strlen')),
        ], $data['items']));

        return $data;
    }

    /** @return array<string, mixed> */
    private function shape(TaskTemplate $t): array
    {
        return [
            'id' => $t->id,
            'name' => (string) $t->name,
            'description' => $t->description,
            'work_type_id' => $t->work_type_id,
            'items' => $t->items ?? [],
        ];
    }
}
