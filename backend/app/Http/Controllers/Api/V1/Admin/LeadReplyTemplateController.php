<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The team's own reply templates, kept next to the built-in ones the
 * dashboard ships with. Stored as one private setting (it is not in
 * Setting::PUBLIC_KEYS, so the public site never reads it).
 *
 * Placeholders in the text — {{name}}, {{company}}, {{service}} — are filled
 * by the dashboard when a template is picked, not here.
 */
class LeadReplyTemplateController extends Controller
{
    private const KEY = 'lead_reply_templates';

    private const MAX = 12;

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->items()]);
    }

    /** Replaces the whole list: add, rename or remove from the page, then save. */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'templates' => ['present', 'array', 'max:'.self::MAX],
            'templates.*.id' => ['nullable', 'string', 'max:40'],
            'templates.*.name' => ['required', 'string', 'max:60'],
            'templates.*.subject' => ['required', 'string', 'max:190'],
            'templates.*.body' => ['required', 'string', 'max:8000'],
        ]);

        $items = collect($data['templates'])->map(fn ($t) => [
            'id' => $t['id'] ?? Str::lower(Str::random(10)),
            'name' => trim($t['name']),
            'subject' => trim($t['subject']),
            'body' => trim($t['body']),
        ])->values()->all();

        Setting::updateOrCreate(['key' => self::KEY], ['value' => ['items' => $items]]);

        return response()->json(['data' => $items]);
    }

    /** @return list<array{id: string, name: string, subject: string, body: string}> */
    private function items(): array
    {
        return array_values(Setting::map()[self::KEY]['items'] ?? []);
    }
}
