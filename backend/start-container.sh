#!/usr/bin/env bash
set -e

# What Railway runs to start this container.
#
# Written explicitly rather than left to Railpack's own default so the exact
# steps live in the repo, but it does the same thing that default would:
# migrate, warm the framework caches with this deploy's real env vars, then
# serve through FrankenPHP (which the PHP provider's image already has
# configured via /Caddyfile) rather than the single-threaded `artisan serve`.
#
# Runs at container start, not at build time — so `optimize` bakes in
# whatever environment variables are set for *this* deploy, and a config
# change on Railway takes effect on the next restart without a rebuild.

php artisan migrate --force

# R2 holds every real upload; nothing in this app reads from the local public
# disk. Kept anyway because it's a no-op if nothing points at it and it is
# what a stock Laravel install expects to exist.
php artisan storage:link --force || true

php artisan optimize:clear
php artisan optimize

exec docker-php-entrypoint --config /Caddyfile --adapter caddyfile
