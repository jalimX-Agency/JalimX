<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\WorkType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The kinds of work on offer, edited in settings.
 *
 * The one thing a type decides is whether that work involves signing in
 * somewhere — a site and a booking platform do, a logo does not — and the
 * logins panel follows that rather than a list written into the code.
 */
class WorkTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => WorkType::query()
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map(fn (WorkType $t) => $this->shape($t)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $type = WorkType::create([
            ...$data,
            'slug' => $this->slug($data['name']),
            'position' => (int) WorkType::max('position') + 1,
        ]);

        return response()->json(['data' => $this->shape($type->refresh())], 201);
    }

    public function update(Request $request, WorkType $workType): JsonResponse
    {
        /*
         * The slug is not renamed with the name. Nothing outside this table
         * reads it today, but a stable handle is worth keeping for the day
         * something does.
         */
        $workType->update($request->validate($this->rules()));

        return response()->json(['data' => $this->shape($workType->fresh())]);
    }

    /**
     * Retiring a type keeps the history: work already tagged with it still
     * says what it was. Deleting is only for one added by mistake.
     */
    public function destroy(WorkType $workType): JsonResponse
    {
        if ($workType->engagements()->exists()) {
            return response()->json([
                'message' => 'Some work is filed under this. Switch it off instead — it stays on the work that already has it, and stops being offered.',
            ], 409);
        }

        $workType->delete();

        return response()->json(null, 204);
    }

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:80'],
            'needs_logins' => ['required', 'boolean'],
            'is_active' => ['required', 'boolean'],
            'position' => ['sometimes', 'integer', 'min:0', 'max:999'],
        ];
    }

    private function slug(string $name): string
    {
        $base = Str::slug($name) ?: 'type';
        $slug = $base;

        for ($n = 2; WorkType::where('slug', $slug)->exists(); $n++) {
            $slug = "$base-$n";
        }

        return $slug;
    }

    /** @return array<string, mixed> */
    private function shape(WorkType $type): array
    {
        return [
            'id' => $type->id,
            'name' => (string) $type->name,
            'slug' => (string) $type->slug,
            'position' => (int) $type->position,
            'needs_logins' => (bool) $type->needs_logins,
            'is_active' => (bool) $type->is_active,
        ];
    }
}
