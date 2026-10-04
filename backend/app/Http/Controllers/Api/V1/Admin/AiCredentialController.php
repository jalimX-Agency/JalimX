<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\AI\ConnectionTester;
use App\AI\CredentialPool;
use App\AI\CredentialStatus;
use App\AI\ErrorType;
use App\AI\Exceptions\ProviderError;
use App\AI\ProviderCatalog;
use App\Http\Controllers\Controller;
use App\Models\AiCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Adding, testing, rotating and removing AI keys from the dashboard.
 *
 * The key goes one way only: in. Every response is built by shape() below,
 * which has no access path to the key — the dashboard sees the last four
 * characters and nothing else, and replacing a key never shows the old one.
 */
class AiCredentialController extends Controller
{
    public function __construct(
        private readonly ConnectionTester $tester,
        private readonly CredentialPool $pool,
    ) {}

    /** The providers the form can offer. No keys, nothing per-account. */
    public function providers(): JsonResponse
    {
        return response()->json([
            'data' => collect(ProviderCatalog::all())->map(fn ($p, $key) => [
                'key' => $key,
                'name' => $p['name'],
                'needs_base_url' => $p['base_url'] === null,
                'models' => $p['models'],
                'keys_at' => $p['keys_at'],
            ])->values(),
        ]);
    }

    public function index(): JsonResponse
    {
        $usage = DB::table('ai_requests')
            ->where('created_at', '>=', now()->startOfDay())
            ->selectRaw("ai_credential_id, count(*) as total, sum(case when outcome = 'ok' then 1 else 0 end) as ok")
            ->groupBy('ai_credential_id')
            ->get()
            ->keyBy('ai_credential_id');

        return response()->json([
            'data' => AiCredential::query()->ordered()->get()
                ->map(fn (AiCredential $c) => $this->shape($c, $usage[$c->id] ?? null)),
        ]);
    }

    /**
     * A new key is tested before it is saved. One the provider refuses is not
     * saved as active: either the form is sent back, or — when asked to keep
     * it anyway — it is saved disabled.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, null);

        $credential = new AiCredential([
            'label' => $data['label'],
            'provider' => $data['provider'],
            'model' => trim($data['model']),
            'base_url' => $data['base_url'] ?? null,
            'priority' => $data['priority'] ?? ((int) AiCredential::max('priority') + 1),
        ]);
        $credential->setKey($data['api_key']);

        $test = $this->tester->test($credential);

        if ($refused = $this->refused($test)) {
            if (! $request->boolean('save_anyway')) {
                return response()->json(['message' => $test['message'], 'test' => $test], 422);
            }
            $credential->status = CredentialStatus::Disabled;
        } else {
            $credential->status = CredentialStatus::Active;
        }

        $credential->save();

        if (! $refused) {
            $this->applyTest($credential, $test);
        }

        return response()->json(['data' => $this->shape($credential->fresh()), 'test' => $test], 201);
    }

    /**
     * Label and priority save as they are. A new key, model, provider or
     * address is tested first, like a new credential. A blank key keeps the
     * one already stored — the old key is never sent back to fill the field.
     */
    public function update(Request $request, AiCredential $credential): JsonResponse
    {
        $data = $this->validated($request, $credential);

        $credential->fill([
            'label' => $data['label'],
            'provider' => $data['provider'],
            'model' => trim($data['model']),
            'base_url' => $data['base_url'] ?? null,
            'priority' => $data['priority'] ?? $credential->priority,
        ]);

        if (filled($data['api_key'] ?? null)) {
            $credential->setKey($data['api_key']);
        }

        $test = null;

        if ($credential->isDirty(['provider', 'model', 'base_url', 'api_key'])) {
            $test = $this->tester->test($credential);

            if ($this->refused($test) && ! $request->boolean('save_anyway')) {
                return response()->json(['message' => $test['message'], 'test' => $test], 422);
            }

            // A changed key or model starts with a clean record.
            $credential->forceFill([
                'cooldown_step' => 0,
                'consecutive_failures' => 0,
                'available_at' => null,
                'last_error_type' => null,
                'last_error_note' => null,
            ]);

            if ($credential->status !== CredentialStatus::Disabled) {
                $credential->status = $this->refused($test) ? CredentialStatus::Disabled : CredentialStatus::Active;
            }
        }

        $credential->save();

        if ($test && ! $this->refused($test)) {
            $this->applyTest($credential, $test);
        }

        return response()->json(['data' => $this->shape($credential->fresh()), 'test' => $test]);
    }

    public function destroy(AiCredential $credential): JsonResponse
    {
        $credential->delete();

        return response()->json(['data' => null]);
    }

    /** Tests a saved key, and lets the result move it in or out of the rotation. */
    public function test(AiCredential $credential): JsonResponse
    {
        $test = $this->tester->test($credential);
        $this->applyTest($credential, $test);

        return response()->json(['data' => $this->shape($credential->fresh()), 'test' => $test]);
    }

    /**
     * Tests what is in the form before it is saved. With `id` and no key,
     * the stored key is used — so an edit can be tested without retyping it.
     */
    public function testDraft(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['nullable', 'integer', 'exists:ai_credentials,id'],
            'provider' => ['required', Rule::in(array_keys(ProviderCatalog::all()))],
            'model' => ['required', 'string', 'max:160'],
            'base_url' => $this->baseUrlRules($request->input('provider')),
            'api_key' => [Rule::requiredIf(! $request->filled('id')), 'nullable', 'string', 'max:500'],
        ]);

        $credential = isset($data['id']) ? AiCredential::findOrFail($data['id'])->replicate() : new AiCredential;
        $credential->fill([
            'provider' => $data['provider'],
            'model' => trim($data['model']),
            'base_url' => $data['base_url'] ?? null,
        ]);
        if (filled($data['api_key'] ?? null)) {
            $credential->setKey($data['api_key']);
        }

        return response()->json(['test' => $this->tester->test($credential)]);
    }

    /** enable · disable · retry (tests now instead of waiting out the rest). */
    public function state(Request $request, AiCredential $credential): JsonResponse
    {
        $action = $request->validate(['action' => ['required', Rule::in(['enable', 'disable', 'retry'])]])['action'];

        if ($action === 'disable') {
            $credential->forceFill(['status' => CredentialStatus::Disabled])->save();

            return response()->json(['data' => $this->shape($credential->fresh())]);
        }

        // Enabling or retrying both start from a clean slate and prove it.
        $credential->forceFill([
            'status' => CredentialStatus::Active,
            'available_at' => null,
            'cooldown_step' => 0,
        ])->save();

        $test = $this->tester->test($credential);
        $this->applyTest($credential, $test);

        return response()->json(['data' => $this->shape($credential->fresh()), 'test' => $test]);
    }

    /** The priority order, as ids from first to last. */
    public function reorder(Request $request): JsonResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array', 'max:200'],
            'ids.*' => ['integer', 'exists:ai_credentials,id'],
        ])['ids'];

        foreach (array_values(array_unique($ids)) as $position => $id) {
            AiCredential::query()->whereKey($id)->update(['priority' => $position + 1]);
        }

        return $this->index();
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?AiCredential $credential): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:80'],
            'provider' => ['required', Rule::in(array_keys(ProviderCatalog::all()))],
            'model' => ['required', 'string', 'max:160'],
            'base_url' => $this->baseUrlRules($request->input('provider')),
            'api_key' => [$credential ? 'nullable' : 'required', 'string', 'min:8', 'max:500'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);
    }

    /**
     * Only the `custom` provider takes an address, and it must be a public
     * HTTPS one. Without this check the server could be pointed at its own
     * network (a cloud metadata address, a database) and made to send a
     * request there carrying whatever key was typed.
     */
    private function baseUrlRules(?string $provider): array
    {
        if ($provider !== 'custom') {
            return ['nullable', 'prohibited'];
        }

        return ['required', 'string', 'max:255', 'url:https', function ($attribute, $value, $fail) {
            $host = parse_url((string) $value, PHP_URL_HOST);
            $ips = $host ? (filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: [])) : [];

            if ($ips === []) {
                $fail('That address does not resolve.');

                return;
            }

            foreach ($ips as $ip) {
                if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    $fail('The address must be a public one.');

                    return;
                }
            }
        }];
    }

    /** A refused key or model: the two failures that mean "do not use this". */
    private function refused(array $test): bool
    {
        return in_array($test['error_type'], [ErrorType::Auth->value, ErrorType::Model->value], true);
    }

    /** Lets a test result move the key, the same way a real request would. */
    private function applyTest(AiCredential $credential, array $test): void
    {
        if ($test['ok']) {
            $this->pool->succeeded($credential);

            return;
        }

        $this->pool->failed($credential, new ProviderError(ErrorType::from($test['error_type']), $test['message']));
    }

    /** @return array<string, mixed> */
    private function shape(AiCredential $c, ?object $usage = null): array
    {
        return [
            'id' => $c->id,
            'label' => $c->label,
            'provider' => $c->provider,
            'provider_name' => ProviderCatalog::name($c->provider),
            'model' => $c->model,
            'base_url' => $c->provider === 'custom' ? $c->base_url : null,
            'key_hint' => '••••'.$c->key_hint,
            'status' => $c->status->value,
            'priority' => $c->priority,
            'available_at' => $c->available_at?->toIso8601String(),
            'last_used_at' => $c->last_used_at?->toIso8601String(),
            'last_success_at' => $c->last_success_at?->toIso8601String(),
            'last_error_at' => $c->last_error_at?->toIso8601String(),
            'last_error_type' => $c->last_error_type,
            'last_error_note' => $c->last_error_note,
            'consecutive_failures' => $c->consecutive_failures,
            'requests_today' => (int) ($usage->total ?? 0),
            'successes_today' => (int) ($usage->ok ?? 0),
        ];
    }
}
