<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Engagement;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The to-do list inside a piece of work.
 *
 * Every change saves on its own — ticking a box is not something anyone
 * expects to confirm with a Save button — so each route answers with the
 * one task it touched, in the shape the list already holds.
 */
class TaskController extends Controller
{
    public function store(Request $request, Engagement $engagement): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:190'],
            'due_on' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $task = $engagement->tasks()->create([
            ...$data,
            // New ones go to the end of the undated pile; dated ones sort by
            // date anyway.
            'position' => (int) $engagement->tasks()->max('position') + 1,
        ]);

        return response()->json(['data' => self::shape($task->refresh())], 201);
    }

    /**
     * Partial on purpose: the list sends only what changed — a tick, a new
     * date, a corrected title — never the whole task back.
     */
    public function update(Request $request, Task $task): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:190'],
            'due_on' => ['sometimes', 'nullable', 'date'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'done' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('done', $data)) {
            // Ticking an already-done task again keeps the moment it was
            // first done, rather than moving it to now.
            $task->done_at = $data['done'] ? ($task->done_at ?? now()) : null;
            unset($data['done']);
        }

        $task->fill($data)->save();

        return response()->json(['data' => self::shape($task->refresh())]);
    }

    public function destroy(Task $task): JsonResponse
    {
        $task->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    public static function shape(Task $task): array
    {
        return [
            'id' => $task->id,
            'engagement_id' => $task->engagement_id,
            'title' => (string) $task->title,
            'notes' => $task->notes,
            'due_on' => $task->due_on?->toDateString(),
            'done_at' => $task->done_at?->toIso8601String(),
            'created_at' => $task->created_at?->toIso8601String(),
        ];
    }
}
