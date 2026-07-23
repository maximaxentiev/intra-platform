#!/usr/bin/env bash
# Deploy Intra Platform (stack-rewrite) to staging on the DigitalOcean droplet.
# Run ON THE DROPLET from the repo root after copying .env (see .env.example).
set -euo pipefail

COMPOSE="docker compose -p intra-ops-test"

# Load env for import + echo at end.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "[deploy] stopping legacy ops-test frontend (if running)…"
docker compose -f /opt/projects/ops-test.intra.ca/app/docker-compose.prod.yml down 2>/dev/null || true

echo "[deploy] building and starting stack…"
$COMPOSE up -d --build

echo "[deploy] waiting for API…"
for i in $(seq 1 40); do
  if $COMPOSE exec -T api node -e "fetch('http://127.0.0.1:8000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[deploy] API healthy."
    break
  fi
  sleep 3
done

if [[ -n "${SOURCE_DATABASE_URL:-}" ]]; then
  echo "[deploy] importing via direct Postgres (SOURCE_DATABASE_URL)…"
  $COMPOSE exec -T -e SOURCE_DATABASE_URL \
    -e DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
    api node dist/db/import-from-supabase.js
elif [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${SUPABASE_URL:-}" ]]; then
  echo "[deploy] importing via Supabase REST API…"
  $COMPOSE exec -T \
    -e SUPABASE_URL \
    -e SUPABASE_SERVICE_ROLE_KEY \
    -e DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}" \
    api node dist/db/import-from-supabase-api.js
else
  echo "[deploy] no import credentials — bootstrap admin only (set SOURCE_DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env)."
fi

echo "[deploy] done. Site: https://${APP_HOST}"
