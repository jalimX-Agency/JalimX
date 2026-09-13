<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;

class SettingController extends Controller
{
    /** Flat key => value map of site copy and contact details. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => Setting::map()]);
    }
}
