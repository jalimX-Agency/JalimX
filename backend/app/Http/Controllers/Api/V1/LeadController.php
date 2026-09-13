<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLeadRequest;
use App\Models\Lead;
use Illuminate\Http\JsonResponse;

class LeadController extends Controller
{
    /**
     * Contact form target. Public and therefore rate limited in routes/api.php.
     * The response deliberately echoes nothing back - there is no reason for a
     * form post to hand an anonymous caller a database row.
     */
    public function store(StoreLeadRequest $request): JsonResponse
    {
        Lead::create([
            ...$request->validated(),
            'ip' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Thanks - we will be in touch shortly.',
        ], 201);
    }
}
