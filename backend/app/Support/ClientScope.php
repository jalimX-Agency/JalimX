<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Which clients the signed-in person may reach.
 *
 * A role set to "assigned clients" limits everything tied to a client (its
 * work, invoices, logins, tasks and WhatsApp conversations) to the clients
 * assigned to that person on the Team page. Everyone else sees every client.
 *
 * Asked many times per request, so the answer is kept for the request.
 */
final class ClientScope
{
    /** @var array<int, list<int>|null> */
    private static array $cache = [];

    /** Null means every client. */
    public static function ids(?User $user): ?array
    {
        if (! $user) {
            return [];
        }

        return self::$cache[$user->id] ??= $user->seesAllClients()
            ? null
            : $user->clients()->pluck('clients.id')->map(fn ($id) => (int) $id)->all();
    }

    public static function forget(): void
    {
        self::$cache = [];
    }

    public static function limited(?User $user): bool
    {
        return self::ids($user) !== null;
    }

    /**
     * Whether a record tied to this client (null: tied to none) is reachable.
     * A record tied to no client is reachable by a limited role only when
     * it says so: WhatsApp conversations with `inbox.unlinked`.
     */
    public static function allows(?User $user, ?int $clientId, ?string $unlinkedPermission = null): bool
    {
        $ids = self::ids($user);
        if ($ids === null) {
            return true;
        }
        if ($clientId === null) {
            return $unlinkedPermission !== null && $user->can($unlinkedPermission);
        }

        return in_array($clientId, $ids, true);
    }

    /** Narrows a query to the reachable clients, on the given column. */
    public static function apply(Builder $query, ?User $user, string $column = 'client_id', ?string $unlinkedPermission = null): Builder
    {
        $ids = self::ids($user);
        if ($ids === null) {
            return $query;
        }

        $withUnlinked = $unlinkedPermission !== null && $user->can($unlinkedPermission);

        return $query->where(function (Builder $q) use ($ids, $column, $withUnlinked) {
            $q->whereIn($column, $ids === [] ? [0] : $ids);
            if ($withUnlinked) {
                $q->orWhereNull($column);
            }
        });
    }
}
