#!/usr/bin/env bash
set -euo pipefail
umask 077
source "$(dirname "$0")/native-env.sh"
socket="$root_dir/.runtime/tmux.sock"
case "${1:-status}" in
  run)
    cd "$root_dir"
    set -a
    source "$root_dir/.env"
    set +a
    exec node "$root_dir/infra/native-supervisor.mjs"
    ;;
  start)
    test -f "$root_dir/.env"
    test -f "$root_dir/.runtime/postgres/PG_VERSION"
    if tmux -S "$socket" has-session -t proview 2>/dev/null; then
      echo 'ProView session already running.'
      exit 0
    fi
    tmux -S "$socket" new-session -d -s proview -c "$root_dir" \
      "exec bash '$root_dir/infra/nativectl.sh' run"
    echo 'Started ProView in its private tmux session; use status to check readiness.'
    ;;
  stop)
    node "$root_dir/infra/native-stop.mjs"
    ;;
  status)
    if tmux -S "$socket" has-session -t proview 2>/dev/null; then
      echo 'ProView supervisor: running'
    else
      echo 'ProView supervisor: stopped'
    fi
    curl --fail --silent --show-error --max-time 5 http://127.0.0.1:33001/api/v1/health/ready
    printf '\n'
    curl --fail --silent --show-error --max-time 5 --output /dev/null \
      --write-out 'Frontend HTTP %{http_code}\n' http://127.0.0.1:33080/login
    ;;
  backup)
    cd "$root_dir"
    set -a
    source "$root_dir/.env"
    set +a
    mkdir -p "$root_dir/.runtime/backups"
    pnpm backup "$root_dir/.runtime/backups/proview-$(date -u +%Y%m%dT%H%M%SZ)"
    ;;
  *) echo 'Usage: bash infra/nativectl.sh start|stop|status|backup' >&2; exit 1 ;;
esac
