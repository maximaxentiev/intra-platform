# Staging checklist — migration `0003_broad_lockheed`

**Apply only on staging** until production is explicitly approved. **Do not** run against production in Phase 0.

---

## 1. Database backup

On the droplet (Compose project `intra-ops-test`):

```bash
cd /opt/projects/intra-platform
docker compose -p intra-ops-test exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "/var/backups/intra-platform-pre-0003-$(date +%Y%m%dT%H%M%S).dump"
```

Verify dump file size > 0 and store off-droplet if policy requires.

---

## 2. Record counts (before)

```bash
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "
SELECT 'staff' AS tbl, count(*) FROM staff
UNION ALL SELECT 'centres', count(*) FROM centres
UNION ALL SELECT 'users', count(*) FROM users;
"
```

Save output.

---

## 3. Migration command

```bash
cd /opt/projects/intra-platform
git pull --ff-only origin main
docker compose -p intra-ops-test run --rm api node dist/db/migrate.js
# Or if migrate runs on container start, recreate api after image build:
# bash scripts/deploy-staging.sh
```

Confirm logs show `[migrate] done.` with no errors.

---

## 4. Schema verification

```bash
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "
\d staff_accounts
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'staff' AND column_name IN ('legal_first_name','legal_last_name','document_slug');
SELECT column_name FROM information_schema.columns
WHERE table_name = 'centres' AND column_name IN ('city','hourly_rate');
"
```

Expect `staff_accounts` table, new staff/centre columns present.

---

## 5. Record counts (after)

Re-run the count query from step 2. **`staff` and `centres` counts must match before/after.**

```bash
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "
SELECT count(*) AS staff_accounts FROM staff_accounts;
"
```

Expect `0` until Phase 1 creates accounts (unless test data added).

---

## 6. Backfill spot-check

```bash
docker compose -p intra-ops-test exec -T postgres psql -U intra -d intra -c "
SELECT id, legal_name, legal_first_name, legal_last_name
FROM staff
LIMIT 10;
"
```

Names should be split where `legal_name` was non-empty.

---

## 7. Ops login smoke test

With **`CARER_PORTAL_ENABLED=false`** (default):

1. Open `https://<APP_HOST>/auth` — ops login works.
2. `GET https://<APP_HOST>/api/health` → `{ "status": "ok" }`.
3. `POST https://<APP_HOST>/api/staff-auth/login` → **404** (portal hidden).

Optional with flag **true** on staging only: carer routes and staff-auth return non-404.

---

## 8. Rollback procedure

1. Stop API/web: `docker compose -p intra-ops-test stop api web`
2. Restore backup:

```bash
docker compose -p intra-ops-test exec -T postgres pg_restore -U intra -d intra --clean --if-exists \
  < /var/backups/intra-platform-pre-0003-YYYYMMDD.dump
```

3. Redeploy previous git tag/commit if application code expects old schema.
4. Re-run ops smoke test.

---

## 9. Sign-off

- [ ] Backup verified
- [ ] Counts match
- [ ] Schema verified
- [ ] Ops smoke pass
- [ ] Carer portal remains disabled for real staff until Phase 1 (`CARER_PORTAL_ENABLED=false`)
