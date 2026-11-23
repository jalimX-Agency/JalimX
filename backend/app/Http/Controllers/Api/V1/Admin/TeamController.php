<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Mail\TeamInviteMail;
use App\Models\User;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;
use Throwable;

/**
 * The people who can sign in to the dashboard.
 *
 * Someone is invited with a role, gets a one-time link to choose their own
 * password, and can be switched off later without being deleted, so what
 * they did keeps a name. Three rules hold throughout: nobody changes their
 * own role or switches themselves off, only an owner can make or touch an
 * owner, and an invite is the only way in: there is no password set here.
 */
class TeamController extends Controller
{
    private const INVITE_DAYS = 7;

    public function index(Request $request): JsonResponse
    {
        $members = User::query()->with('roles')->orderBy('name')->get();

        return response()->json([
            'data' => [
                'members' => $members->map(fn (User $u) => $this->shape($u, $request->user()))->values(),
                'roles' => RoleController::rolesPayload(),
                'permissions' => Permissions::catalog(),
            ],
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:190', Rule::unique('users', 'email')],
            'role' => ['required', 'string', Rule::exists('roles', 'name')],
        ]);

        $this->guardRole($request->user(), $data['role']);

        $member = DB::transaction(function () use ($data, $request) {
            $member = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                // Unusable until the invite is accepted and they choose their own.
                'password' => Hash::make(Str::random(48)),
                'invited_by' => $request->user()->id,
            ]);
            $member->syncRoles([$data['role']]);

            return $member;
        });

        [$url, $mailed, $error] = $this->sendInvite($member, $request->user());

        return response()->json([
            'data' => [
                'member' => $this->shape($member->fresh('roles'), $request->user()),
                'invite_url' => $url,
                'emailed' => $mailed,
                'email_error' => $error,
            ],
        ], 201);
    }

    /** A new link (the old one stops working), sent again. */
    public function resend(Request $request, User $user): JsonResponse
    {
        if ($user->invite_accepted_at !== null) {
            throw ValidationException::withMessages(['user' => 'This person has already joined.']);
        }
        $this->guardMember($request->user(), $user);

        [$url, $mailed, $error] = $this->sendInvite($user, $request->user());

        return response()->json([
            'data' => [
                'member' => $this->shape($user->fresh('roles'), $request->user()),
                'invite_url' => $url,
                'emailed' => $mailed,
                'email_error' => $error,
            ],
        ]);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'role' => ['sometimes', 'string', Rule::exists('roles', 'name')],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $me = $request->user();
        $this->guardMember($me, $user);

        if ($user->is($me) && (array_key_exists('role', $data) || array_key_exists('is_active', $data))) {
            throw ValidationException::withMessages([
                'user' => 'You cannot change your own role or switch yourself off. Ask another owner.',
            ]);
        }

        if (array_key_exists('role', $data)) {
            $this->guardRole($me, $data['role']);
            $user->syncRoles([$data['role']]);
        }

        if (array_key_exists('is_active', $data)) {
            $user->is_active = $data['is_active'];
            if (! $data['is_active']) {
                // Signed out everywhere: database sessions and "remember me" alike.
                $user->setRememberToken(Str::random(60));
                DB::table('sessions')->where('user_id', $user->id)->delete();
            }
        }

        if (array_key_exists('name', $data)) {
            $user->name = $data['name'];
        }

        $user->save();

        return response()->json(['data' => $this->shape($user->fresh('roles'), $me)]);
    }

    /**
     * Only an invite nobody accepted can be removed. Anyone who has signed in
     * is switched off instead, so their name stays on what they did.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->guardMember($request->user(), $user);

        if ($user->invite_accepted_at !== null) {
            throw ValidationException::withMessages([
                'user' => 'This person has already signed in. Switch them off instead; their history stays.',
            ]);
        }

        $user->delete();

        return response()->json(null, 204);
    }

    /** @return array{0: string, 1: bool, 2: ?string} */
    private function sendInvite(User $member, User $by): array
    {
        $token = Str::random(48);
        $member->forceFill([
            'invite_token' => hash('sha256', $token),
            'invite_expires_at' => now()->addDays(self::INVITE_DAYS),
        ])->save();

        $url = rtrim((string) config('services.frontend.url'), '/').'/admin/invite?token='.$token;
        $role = $member->getRoleNames()->first() ?? 'member';

        try {
            Mail::to($member->email)->send(new TeamInviteMail($member, $url, $by->name, $role));

            return [$url, true, null];
        } catch (Throwable $e) {
            report($e);

            // The link is still good: it is shown so it can be sent another way.
            return [$url, false, Str::limit($e->getMessage(), 200)];
        }
    }

    /** Only an owner can give the owner role. */
    private function guardRole(User $me, string $role): void
    {
        if ($role === Permissions::OWNER_ROLE && ! $me->isOwner()) {
            throw ValidationException::withMessages(['role' => 'Only an owner can make someone an owner.']);
        }
    }

    /** Only an owner can change an owner. */
    private function guardMember(User $me, User $member): void
    {
        if ($member->isOwner() && ! $me->isOwner()) {
            abort(403, 'Only an owner can change an owner.');
        }
    }

    private function shape(User $u, User $me): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->roles->first()?->name,
            'status' => $u->status(),
            'is_you' => $u->is($me),
            'invite_expires_at' => $u->invite_accepted_at === null ? $u->invite_expires_at?->toIso8601String() : null,
            'last_login_at' => $u->last_login_at?->toIso8601String(),
            'created_at' => $u->created_at?->toIso8601String(),
        ];
    }
}
