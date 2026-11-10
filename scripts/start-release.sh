#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")" && pwd -P)
if [[ -z "${DATABASE_URL:-}" ]]; then
  state=${SHIPOS_DATA_DIR:-"$root/data"}
  mkdir -p "$state"
  state=$(cd "$state" && pwd -P)
  database="$state/shipos.db"
  if [[ ! -f "$database" ]]; then
    seed=$(mktemp "$state/.shipos-seed.XXXXXX")
    trap 'rm -f "$seed"' EXIT
    cp "$root/shipos-seed.db" "$seed"
    chmod 600 "$seed"
    if ! ln "$seed" "$database" 2>/dev/null && [[ ! -f "$database" ]]; then
      echo "Unable to initialize the SQLite database." >&2
      exit 1
    fi
    rm -f "$seed"
    trap - EXIT
  fi
  export DATABASE_URL="file:$database"
fi
export HOSTNAME=${SHIPOS_HOST:-127.0.0.1}
export PORT=${PORT:-3000}
exec node "$root/app/server.js"
