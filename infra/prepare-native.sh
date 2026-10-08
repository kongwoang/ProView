#!/usr/bin/env bash
# Creates an empty production database and builds the app; never seeds demo data.
set -euo pipefail
umask 077
source "$(dirname "$0")/native-env.sh"
cd "$root_dir"
if tmux -S "$root_dir/.runtime/tmux.sock" has-session -t proview 2>/dev/null; then
  echo 'Stop the ProView session before preparing a release.' >&2
  exit 1
fi
mkdir -p .runtime/{logs,tmp,secrets,sockets,files,backups,cache,config,share}
node --input-type=module <<'NODE'
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
const root = process.cwd();
if (!existsSync('.env')) {
  if (existsSync('.runtime/postgres/PG_VERSION')) {
    throw new Error('Existing database without environment: recover its configuration first.');
  }
  const ownerPassword = randomBytes(32).toString('hex');
  const appPassword = randomBytes(32).toString('hex');
  const jwt = randomBytes(48).toString('hex');
  const write = (path, text) => writeFileSync(path, text, { mode: 0o600, flag: 'wx' });
  write('.runtime/secrets/postgres-password', `${ownerPassword}\n`);
  write('.runtime/secrets/pgpass', `127.0.0.1:35432:*:proview_owner:${ownerPassword}\n127.0.0.1:35432:*:proview:${appPassword}\n`);
  write('.runtime/secrets/database-bootstrap.sql', `CREATE ROLE proview LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE;\nCREATE DATABASE proview OWNER proview;\n`);
  write('.env', [
    'NODE_ENV=production', 'APP_ENV=production', 'PORT=33001', 'BIND_ADDRESS=127.0.0.1',
    `DATABASE_URL=postgresql://proview:${appPassword}@127.0.0.1:35432/proview?schema=public`,
    `JWT_ACCESS_SECRET=${jwt}`, 'ACCESS_TOKEN_TTL_SECONDS=900', 'REFRESH_TOKEN_TTL_DAYS=7',
    'FRONTEND_URL=https://proview.hoangpc.io.vn', 'COOKIE_SECURE=true', 'TRUST_PROXY=true',
    'ENABLE_API_DOCS=false', 'SEED_DEMO=false', 'STORAGE_DRIVER=local',
    `STORAGE_LOCAL_PATH=${resolve(root, '.runtime/files')}`, 'MAX_UPLOAD_BYTES=20971520',
    'PROVIEW_API_INTERNAL_URL=http://127.0.0.1:33001',
  ].join('\n') + '\n');
  console.log('Created protected production configuration; no secrets printed.');
}
NODE
set -a
source .env
set +a
if [[ ! -f .runtime/postgres/PG_VERSION ]]; then
  initdb -D "$root_dir/.runtime/postgres" -U proview_owner \
    --auth-local=scram-sha-256 --auth-host=scram-sha-256 \
    --pwfile="$root_dir/.runtime/secrets/postgres-password" --encoding=UTF8 --locale=C
  cat >> .runtime/postgres/postgresql.conf <<CONF

# ProView native deployment: private sockets and loopback-only TCP.
listen_addresses = '127.0.0.1'
port = 35432
unix_socket_directories = '$root_dir/.runtime/sockets'
unix_socket_permissions = 0700
password_encryption = 'scram-sha-256'
max_connections = 40
shared_buffers = '128MB'
work_mem = '4MB'
dynamic_shared_memory_type = mmap
CONF
fi
pg_ctl -D "$root_dir/.runtime/postgres" -l "$root_dir/.runtime/logs/postgres-prepare.log" start
trap 'pg_ctl -D "$root_dir/.runtime/postgres" stop -m fast' EXIT
if [[ -f .runtime/secrets/database-bootstrap.sql ]]; then
  psql -h 127.0.0.1 -p 35432 -U proview_owner -d postgres -v ON_ERROR_STOP=1 \
    -f .runtime/secrets/database-bootstrap.sql
  rm .runtime/secrets/database-bootstrap.sql
fi
pnpm install --frozen-lockfile --store-dir "$root_dir/.pnpm-store"
pnpm db:generate
pnpm db:migrate
nice -n 10 pnpm --filter @proview/api build
nice -n 10 pnpm --filter @proview/web build
standalone="$root_dir/apps/web/.next/standalone/apps/web"
mkdir -p "$standalone/.next/static" "$standalone/public"
cp -a apps/web/.next/static/. "$standalone/.next/static/"
cp -a apps/web/public/. "$standalone/public/"
"$root_dir/.tools/caddy" validate --config "$root_dir/infra/native.Caddyfile" --adapter caddyfile
echo 'Native release prepared. Use bash infra/nativectl.sh start to run it.'
