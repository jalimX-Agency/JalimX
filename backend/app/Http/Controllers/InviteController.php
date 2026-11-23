<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

/**
 * Accepting an invite: the link's token, then a password of their own.
 *
 * On the web routes, like login, because accepting signs the person in with
 * the same session cookie the dashboard uses.
 */
class InviteController extends Controller
{
    /** Who the link is for, so the page can greet them. Says nothing else. */
    public function show(string $token): JsonResponse
    {
        $user = $this->find($token);

        return response()->json([
            'data' => ['name' => $user->name, 'email' => $user->email],
        ]);
    }

    public function accept(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'max:100'],
            'password' => ['required', 'confirmed', Password::min(10)],
        ]);

        $user = $this->find($data['token']);

        $user->forceFill([
            'password' => $data['password'],
            'invite_token' => null,
            'invite_expires_at' => null,
            'invite_accepted_at' => now(),
            'last_login_at' => now(),
        ])->save();

        Auth::guard('web')->login($user, remember: true);
        $request->session()->regenerate();

        return response()->json(['data' => $user->profile()]);
    }

    private function find(string $token): User
    {
        $user = User::query()
            ->where('invite_token', hash('sha256', $token))
            ->where('is_active', true)
            ->whereNull('invite_accepted_at')
            ->first();

        if (! $user || ! $user->invite_expires_at || $user->invite_expires_at->isPast()) {
            throw ValidationException::withMessages([
                'token' => 'This invite link has expired or was already used. Ask for a new one.',
            ])->status(410);
        }

        return $user;
    }
}
