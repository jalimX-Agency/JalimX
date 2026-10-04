<?php

namespace App\Models;

use App\AI\CredentialStatus;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * One API key for one AI provider.
 *
 * The key is encrypted at rest by the `encrypted` cast (Laravel's Crypt, keyed
 * by APP_KEY) and hidden from serialisation. It is decrypted only when a
 * driver reads `$credential->api_key` to make a request — nothing that builds
 * a response for the browser ever touches it.
 */
class AiCredential extends Model
{
    protected $fillable = [
        'label', 'provider', 'model', 'base_url', 'status', 'priority', 'allows_personal_data',
    ];

    /** Never serialised by accident. */
    protected $hidden = ['api_key'];

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'status' => CredentialStatus::class,
            'priority' => 'integer',
            'allows_personal_data' => 'boolean',
            'available_at' => 'datetime',
            'last_used_at' => 'datetime',
            'last_success_at' => 'datetime',
            'last_error_at' => 'datetime',
            'cooldown_step' => 'integer',
            'consecutive_failures' => 'integer',
        ];
    }

    /** Sets the key and the four characters the dashboard is allowed to show. */
    public function setKey(string $plain): void
    {
        $plain = trim($plain);
        $this->api_key = $plain;
        $this->key_hint = mb_substr($plain, -4);
    }

    /**
     * Laravel decides whether the key changed by decrypting the stored one. A
     * key saved under a different APP_KEY cannot be decrypted — and that is
     * exactly the key someone is trying to replace — so here an unreadable
     * old value simply counts as different.
     */
    public function originalIsEquivalent($key)
    {
        try {
            return parent::originalIsEquivalent($key);
        } catch (DecryptException) {
            return false;
        }
    }

    /**
     * Usable right now: active, or resting with its rest over. A resting key
     * is not probed to see whether it recovered — the next real request is
     * the test, so no quota is spent finding out.
     */
    public function scopeAvailable(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->where('status', CredentialStatus::Active)
                ->orWhere(function (Builder $q) {
                    $q->where('status', CredentialStatus::CoolingDown)
                        ->where(fn (Builder $q) => $q->whereNull('available_at')->orWhere('available_at', '<=', now()));
                });
        });
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('priority')->orderBy('id');
    }
}
