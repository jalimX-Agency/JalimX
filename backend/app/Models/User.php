<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Support\Permissions;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_active',
        'invite_token',
        'invite_expires_at',
        'invite_accepted_at',
        'invited_by',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    /** New accounts are on until someone switches them off. */
    protected $attributes = [
        'is_active' => true,
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'invite_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'invite_expires_at' => 'datetime',
            'invite_accepted_at' => 'datetime',
            'last_login_at' => 'datetime',
        ];
    }

    /** The clients assigned to this person on the Team page. */
    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(Client::class)->withTimestamps();
    }

    /**
     * True unless every role this person holds is limited to assigned
     * clients. The owner always sees every client.
     */
    public function seesAllClients(): bool
    {
        if ($this->isOwner()) {
            return true;
        }

        $roles = $this->roles;

        return $roles->isEmpty() || $roles->contains(fn ($role) => ($role->client_scope ?? 'all') !== 'assigned');
    }

    public function isOwner(): bool
    {
        return $this->hasRole(Permissions::OWNER_ROLE);
    }

    /** active, invited (link sent, not used yet) or disabled. */
    public function status(): string
    {
        if (! $this->is_active) {
            return 'disabled';
        }

        return $this->invite_accepted_at === null ? 'invited' : 'active';
    }

    /**
     * What this person may do, as the dashboard reads it. The owner holds
     * every permission, including any added after their role was created.
     *
     * @return list<string>
     */
    public function permissionNames(): array
    {
        return $this->isOwner()
            ? Permissions::all()
            : $this->getAllPermissions()->pluck('name')->values()->all();
    }

    /** The signed-in person, for /auth/me and the login response. */
    public function profile(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->getRoleNames(),
            'permissions' => $this->permissionNames(),
        ];
    }
}
