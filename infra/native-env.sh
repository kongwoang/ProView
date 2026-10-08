#!/usr/bin/env bash
# Source from the native deployment scripts; never override the user's HOME.
root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
export PATH="$root_dir/.tools/node/bin:$root_dir/.tools/pnpm/node_modules/.bin:$root_dir/.tools/postgres/bin:$PATH"
export TMPDIR="$root_dir/.runtime/tmp"
export XDG_CACHE_HOME="$root_dir/.runtime/cache"
export XDG_CONFIG_HOME="$root_dir/.runtime/config"
export XDG_DATA_HOME="$root_dir/.runtime/share"
export npm_config_cache="$root_dir/.runtime/cache/npm"
export PGPASSFILE="$root_dir/.runtime/secrets/pgpass"
export NEXT_TELEMETRY_DISABLED=1
export PROVIEW_API_INTERNAL_URL=http://127.0.0.1:33001
export NODE_OPTIONS=--max-old-space-size=3072
