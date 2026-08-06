# Domain migration: platform.intra.ca

Prepare-only checklist (no DNS change in repo). Same Docker Compose project **`intra-ops-test`**
so Postgres/Redis volumes are unchanged.

## Server `.env` updates

```bash
APP_HOST=platform.intra.ca
LEGACY_APP_HOST=ops-test.intra.ca
# APP_PUBLIC_URL=https://platform.intra.ca   # optional; compose sets https://${APP_HOST}
# CORS is set in docker-compose.yml from APP_HOST + LEGACY_APP_HOST
```

Keep existing `POSTGRES_*`, `SESSION_SECRET`, `BOOTSTRAP_*`, and object-storage keys as-is.

## Deploy (on droplet)

```bash
cd /opt/projects/intra-platform
git pull --ff-only origin main
bash scripts/deploy-staging.sh
```

## DNS (when ready — not done by this repo)

Point **`platform.intra.ca`** A/AAAA to the same droplet IP as `ops-test.intra.ca`
(`162.243.15.122` at time of writing). Keep `ops-test.intra.ca` until redirect is verified.

## Post-deploy smoke

See report checklist in the migration commit message / PR.
