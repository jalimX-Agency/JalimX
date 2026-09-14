<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Session login for the dashboard.
 *
 * These live on the web routes rather than under /api on purpose: Sanctum's
 * SPA mode authenticates the dashboard with the ordinary Laravel session
 * cookie, and only the web middleware group starts a session. The cookie is
 * httpOnly, so unlike a bearer token in localStorage it cannot be read by any
 * script that manages to run on the page.
 */
class AuthController extends Controller
{
    /** Attempts allowed per email+IP pair before the door closes for a minute. */
    private const MAX_ATTEMPTS = 5;

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        /*
         * Keyed on the email as well as the address, so one person fumbling
         * their own password cannot lock out everyone else behind the same
         * NAT, and someone spraying a list of emails from one address still
         * gets stopped.
         */
        $key = 'login:'.mb_strtolower($credentials['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            throw ValidationException::withMessages([
                'email' => __('auth.throttle', [
                    'seconds' => RateLimiter::availableIn($key),
                ]),
            ])->status(429);
        }

        if (! Auth::attempt($credentials, $request->boolean('remember'))) {
            RateLimiter::hit($key, 60);

            // One message for both a wrong password and an unknown address:
            // saying which is which tells an attacker whose email is real.
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        RateLimiter::clear($key);

        // A new session id on privilege change, so a session id captured before
        // login is worthless afterwards.
        $request->session()->regenerate();

        return response()->json(['data' => $this->profile($request)]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['data' => null]);
    }

    /** @return array<string, mixed> */
    private function profile(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
