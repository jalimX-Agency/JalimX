<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\AI\AIManager;
use App\AI\Exceptions\AiRequestFailed;
use App\AI\Exceptions\AiUnavailable;
use App\AI\Tasks\TextAssist;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Writing help for the dashboard's text fields. The page never talks to a
 * provider: it sends the field and its surroundings here, and gets text back.
 */
class AiAssistController extends Controller
{
    public function __invoke(Request $request, AIManager $ai): JsonResponse
    {
        $input = $request->validate([
            'action' => ['required', Rule::in(TextAssist::ACTIONS)],
            'text' => ['nullable', 'string', 'max:8000'],
            'target_lang' => ['nullable', Rule::in(['en', 'fr', 'ar'])],
            'field' => ['nullable', 'array'],
            'field.label' => ['nullable', 'string', 'max:200'],
            'field.hint' => ['nullable', 'string', 'max:300'],
            'field.page' => ['nullable', 'string', 'max:200'],
            'field.lang' => ['nullable', Rule::in(['en', 'fr', 'ar'])],
            'field.max_length' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'field.multiline' => ['nullable', 'boolean'],
            'context' => ['nullable', 'array', 'max:12'],
            'context.*.label' => ['nullable', 'string', 'max:200'],
            'context.*.value' => ['nullable', 'string', 'max:600'],
        ]);

        // Continuing or reworking nothing is not a request worth a quota.
        if ($input['action'] !== 'write' && trim((string) ($input['text'] ?? '')) === '') {
            return response()->json(['message' => 'There is no text to work on yet.'], 422);
        }

        try {
            ['output' => $text, 'result' => $result] = $ai->generate(
                ['task' => 'text_assist', 'input' => $input],
                $request->user()?->id,
            );
        } catch (AiUnavailable $e) {
            return response()->json(['message' => $e->getMessage(), 'reasons' => $e->reasons], 503);
        } catch (AiRequestFailed $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'data' => [
                'text' => $text,
                // Which key answered, so a bad suggestion can be traced. Never the key.
                'source' => $result->credentialLabel,
                'model' => $result->model,
            ],
        ]);
    }
}
