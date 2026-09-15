<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLeadRequest;
use App\Models\Lead;
use App\Notifications\NewLeadReceived;
use Illuminate\Support\Facades\Notification;
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
        $lead = Lead::create([
            ...$request->validated(),
            'ip' => $request->ip(),
        ]);

        /*
         * After the response, and never able to fail it: the lead is already
         * saved, and a mail server being down is no reason to tell the person
         * their message did not go through.
         */
        if ($to = config('services.leads.notify')) {
            dispatch(function () use ($to, $lead) {
                try {
                    Notification::route('mail', $to)->notify(new NewLeadReceived($lead));
                } catch (\Throwable $e) {
                    report($e);
                }
            })->afterResponse();
        }

        return response()->json([
            'message' => 'Thanks - we will be in touch shortly.',
        ], 201);
    }
}
