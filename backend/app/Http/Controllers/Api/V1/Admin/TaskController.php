<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Engagement;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Every task, wherever it belongs: to a piece of work, to a client only,
 * or to nobody at all.
 *
 * Every change saves on its own — ticking a box is not something anyone
 * expects to confirm with a Save button — so each route answers with the
 * one task it touched, in the shape the lists already hold.
 */
class TaskController extends Controller
{
    /**
     * The whole list, for the Tasks page. Everything still open, however
     * old, plus what was finished in the last month — enough to see what
     * was done, not an archive.
     */
    public function index(): JsonResponse
    {
        $tasks = Task::query()
            ->where(fn ($q) => $q
                ->whereNull('done_at')
                ->orWhere('done_at', '>=', now()->subDays(30)))
            ->with('engagement:id,title,client_id', 'client:id,name')
            ->orderByRaw('done_at is not null')
            ->orderByRaw('due_on is null')
            ->orderBy('due_on')
            ->orderBy('position')
            ->orderByDesc('done_at')
            ->orderBy('id')
            ->limit(1000)
            ->get();

        // What a task can be linked to: every client, and the work under
        // it that is not finished or dropped.
        $links = Client::query()
            ->orderBy('name')
            ->with(['engagements' => fn ($q) => $q
                ->whereNotIn('status', ['done', 'cancelled'])
                ->select('id', 'client_id', 'title')])
            ->get(['id', 'name'])
            ->map(fn (Client $c) => [
                'id' => $c->id,
                'name' => (string) $c->name,
                'works' => $c->engagements
                    ->map(fn (Engagement $e) => ['id' => $e->id, 'title' => (string) $e->title])
                    ->values(),
            ]);

        return response()->json([
            'data' => $tasks->map(fn (Task $t) => self::shape($t))->values(),
            'links' => $links,
        ]);
    }

    /** From the Tasks page: linked to a work, a client, or nothing. */
    public function store(Request $request): JsonResponse
    {
        return $this->create($request->validate($this->rules(creating: true)));
    }

    /** From inside a work: the link is the work itself. */
    public function storeForEngagement(Request $request, Engagement $engagement): JsonResponse
    {
        $data = $request->validate($this->rules(creating: true));
        $data['engagement_id'] = $engagement->id;

        return $this->create($data);
    }

    /**
     * Partial on purpose: the list sends only what changed — a tick, a new
     * date, a status — never the whole task back.
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate($this->rules(creating: false));
        $wasDone = $task->done_at !== null;

        if (array_key_exists('done', $data)) {
            $data['status'] = $data['done']
                ? 'done'
                : ($task->status === 'done' ? 'todo' : $task->status);
            unset($data['done']);
        }

        $task->fill($data);
        $this->settle($task);

        $next = DB::transaction(function () use ($task, $wasDone) {
            $task->save();

            return ! $wasDone && $task->done_at ? $this->repeatAfter($task) : null;
        });

        return response()->json([
            'data' => self::shape($task->refresh()->load(self::WITH)),
            // A repeating task, once done, comes back with its next date.
            'next' => $next ? self::shape($next) : null,
        ]);
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(null, 204);
    }

    public const WITH = ['engagement:id,title,client_id', 'client:id,name'];

    /** @param array<string, mixed> $data */
    private function create(array $data): JsonResponse
    {
        if (array_key_exists('done', $data)) {
            $data['status'] = $data['done'] ? 'done' : 'todo';
            unset($data['done']);
        }

        $task = new Task(['status' => 'todo', 'priority' => 'normal', ...$data]);
        $this->settle($task);
        // New ones go to the end of the undated pile; dated ones sort by
        // date anyway.
        $task->position = (int) Task::query()->max('position') + 1;
        $task->save();

        return response()->json(['data' => self::shape($task->refresh()->load(self::WITH))], 201);
    }

    /** @return array<string, mixed> */
    private function rules(bool $creating): array
    {
        return [
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:190'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'due_on' => ['sometimes', 'nullable', 'date'],
            'done' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(Task::STATUSES)],
            'priority' => ['sometimes', Rule::in(Task::PRIORITIES)],
            'progress' => ['sometimes', 'integer', 'between:0,100'],
            'repeat' => ['sometimes', 'nullable', Rule::in(Task::REPEATS)],
            'engagement_id' => ['sometimes', 'nullable', 'integer', 'exists:engagements,id'],
            'client_id' => ['sometimes', 'nullable', 'integer', 'exists:clients,id'],
            'checklist' => ['sometimes', 'nullable', 'array', 'max:50'],
            'checklist.*.text' => ['required', 'string', 'max:190'],
            'checklist.*.done' => ['required', 'boolean'],
        ];
    }

    /**
     * Keep the fields that describe the same thing in agreement, whatever
     * combination was sent.
     */
    private function settle(Task $task): void
    {
        // A work decides the client; a client stands alone only when there
        // is no work.
        if ($task->engagement_id) {
            $task->client_id = Engagement::query()->whereKey($task->engagement_id)->value('client_id');
        }

        $list = collect($task->checklist ?? [])
            ->map(fn ($i) => ['text' => trim((string) $i['text']), 'done' => (bool) $i['done']])
            ->filter(fn ($i) => $i['text'] !== '')
            ->values();
        $task->checklist = $list->isEmpty() ? null : $list->all();

        // done_at is the record of when; status is how it is shown. The
        // first moment of being done is kept if it is ticked again.
        if ($task->status === 'done') {
            $task->done_at ??= now();
        } else {
            $task->done_at = null;
        }

        if ($list->isNotEmpty()) {
            // With a checklist, progress is counted, not guessed.
            $task->progress = (int) round(100 * $list->where('done', true)->count() / $list->count());
        } elseif ($task->status === 'done') {
            $task->progress = 100;
        } elseif ($task->status === 'todo' && $task->getOriginal('status') === 'done') {
            // Un-ticked: it is not finished any more, so it is not 100%.
            $task->progress = 0;
        }

        // Something that repeats needs a date to repeat from.
        if ($task->repeat && ! $task->due_on) {
            $task->due_on = Carbon::today();
        }
    }

    /**
     * The next one of a repeating task. The repeat moves to the new task,
     * so un-ticking and re-ticking the old one does not make a second.
     */
    private function repeatAfter(Task $task): ?Task
    {
        $due = $task->nextDue(Carbon::today());
        if (! $due) {
            return null;
        }

        $next = $task->replicate(['done_at', 'status', 'progress', 'due_on', 'checklist']);
        $next->fill([
            'status' => 'todo',
            'progress' => 0,
            'due_on' => $due,
            'checklist' => $task->checklist
                ? array_map(fn ($i) => [...$i, 'done' => false], $task->checklist)
                : null,
        ]);
        $next->save();

        $task->forceFill(['repeat' => null])->save();

        return $next->load(self::WITH);
    }

    /** @return array<string, mixed> */
    public static function shape(Task $task): array
    {
        return [
            'id' => $task->id,
            'engagement_id' => $task->engagement_id,
            'client_id' => $task->client_id,
            'work' => $task->relationLoaded('engagement') ? $task->engagement?->title : null,
            'client' => $task->relationLoaded('client') ? $task->client?->name : null,
            'title' => (string) $task->title,
            'status' => (string) ($task->status ?: 'todo'),
            'priority' => (string) ($task->priority ?: 'normal'),
            'progress' => (int) $task->progress,
            'notes' => $task->notes,
            'checklist' => $task->checklist ?? [],
            'due_on' => $task->due_on?->toDateString(),
            'repeat' => $task->repeat,
            'done_at' => $task->done_at?->toIso8601String(),
            'created_at' => $task->created_at?->toIso8601String(),
        ];
    }
}
