#!/usr/bin/env bash
# Deploy Intra Platform to the DigitalOcean droplet (Compose project intra-ops-test).
# Set APP_HOST=platform.intra.ca and LEGACY_APP_HOST=ops-test.intra.ca in .env before deploy.
# Run ON THE DROPLET from the repo root after copying .env (see .env.example).
# Shell scripts in this repo use LF line endings (.gitattributes).
set -euo pipefail

COMPOSE="docker compose -p intra-ops-test"

# Load env for import + echo at end.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "[deploy] stopping legacy ops-test frontend (if running)â€¦"
docker compose -f /opt/projects/ops-test.intra.ca/app/docker-compose.prod.yml down 2>/dev/null || true

echo "[deploy] building and starting stackâ€¦"
$COMPOSE up -d --build

echo "[deploy] waiting for APIâ€¦"
for i in $(seq 1 40); do
  if $COMPOSE exec -T api node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[deploy] API healthy."
    break
  fi
  sleep 3
done

if [[ -n "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "[deploy] importing via direct Postgres (SOURCE_DATABASE_URL)â€¦"
  $COMPOSE exec -T -e SOURCE_DATABASE_URL \
    -e DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
    api node dist/db/import-from-supabase.js
elif [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${SUPABASE_URL:-}" ]]; then
  echo "[deploy] importing via Supabase REST APIâ€¦"
  $COMPOSE exec -T \
    -e SUPABASE_URL \
    -e SUPABASE_SERVICE_ROLE_KEY \
    -e DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
    api node dist/db/import-from-supabase-api.js
else
  echo "[deploy] no import credentials â€” bootstrap admin only (set SOURCE_DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env)."
fi

echo "[deploy] done. Site: https://${APP_HOST}"
