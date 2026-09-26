#!/usr/bin/env bash
# Deploy on the VPS: pull, build both apps, restart, verify.
set -euo pipefail
cd "$(dirname "$0")"

for app in backend frontend; do
  [ -f "$app/.env" ] || { echo "missing $app/.env"; exit 1; }
done

git pull --ff-only

# frontend bakes BACKEND_URL into rewrites() at build time, so .env must exist first
for app in backend frontend; do
  ( cd "$app" && npm ci && npm run build )
done

sudo systemctl restart eros-backend eros-frontend

# A restart that comes back 502 is a failed deploy, so wait for both to answer.
for url in http://127.0.0.1:4000/api/health http://127.0.0.1:3000/; do
  for i in $(seq 30); do
    curl -fsS -o /dev/null "$url" && break
    [ "$i" = 30 ] && { echo "FAILED: $url never answered"; journalctl -n 30 -u eros-backend -u eros-frontend --no-pager; exit 1; }
    sleep 1
  done
done

echo "deployed: $(git rev-parse --short HEAD)"
