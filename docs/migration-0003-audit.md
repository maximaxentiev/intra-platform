# Migration `0003_broad_lockheed` — safety audit

**Status:** Phase 0 review. **Not production-approved** until staging checklist completed and signed off.

**File:** `apps/api/drizzle/0003_broad_lockheed.sql`

---

## Summary

| Check | Finding |
|-------|---------|
| Existing `staff` rows preserved | **Yes** — `ALTER TABLE ... ADD COLUMN` with `DEFAULT ''`; no `DELETE`/`DROP` on `staff`. |
| `legal_first_name` / `legal_last_name` backfill | **Yes** — single `UPDATE` only where `legal_first_name = ''` and `legal_name` is non-empty; idempotent for already-backfilled rows. |
| Existing `centres` preserved | **Yes** — additive columns only (`city` default `''`, nullable `hourly_rate`). |
| Destructive operations | **None** — no table drops, no column drops, no mass deletes. |
| Re-run safety | **No** — standard Drizzle migration; second apply fails on `CREATE TYPE` / `CREATE TABLE` / duplicate columns. Use DB backup + forward-fix only. |

---

## Step-by-step

### 1. `CREATE TYPE staff_account_status`

- New enum; no impact on existing data.
- **Re-run:** fails if type exists.

### 2. `CREATE TABLE staff_accounts`

- Empty table at migrate time; no FK violation.
- **Unique constraints:** `staff_id` (one account per staff), `email` (global unique).
- **Risk:** Inserts later can fail if duplicate emails or second account for same `staff_id` — expected application constraint, not migration failure.

### 3. `centres` — `city`, `hourly_rate`

- `city` `NOT NULL DEFAULT ''` — existing rows get empty string.
- `hourly_rate` nullable — existing rows `NULL`.
- **Re-run:** fails if columns exist.

### 4. `staff` — name, address, city, `document_slug`

- All new columns have safe defaults except `document_slug` (nullable).
- **Unique `document_slug`:** PostgreSQL allows **multiple NULLs**; only non-null slugs must be unique. Empty-string slugs are not used (column is null until set).
- **Risk:** If legacy data ever contained duplicate non-null slugs before migration, add constraint would fail — column is new, all NULL initially, so **no risk on upgrade**.

### 5. Backfill `legal_first_name` / `legal_last_name`

```sql
UPDATE "staff"
SET "legal_first_name" = split_part(trim("legal_name"), ' ', 1),
    "legal_last_name"  = COALESCE(regexp_replace(trim("legal_name"), '^\S+\s*', ''), '')
WHERE "legal_first_name" = '' AND trim("legal_name") <> '';
```

- Single-word names: last name becomes `''`.
- Already populated first names (re-run hypothetical): **skipped** by `WHERE legal_first_name = ''`.
- Does not modify `legal_name` canonical column.

### 6. FK `staff_accounts.staff_id` → `staff.id` ON DELETE CASCADE

- Deleting a staff row removes portal account — intentional coupling.
- **Warning:** Ops deleting staff removes carer login; document in runbook.

### 7. Index `staff_accounts_email_idx`

- Non-unique index in addition to unique constraint — performance only.

---

## Rollback limitations

Drizzle does not ship a down migration for `0003`. Rollback options:

1. **Restore from backup** (recommended).
2. **Manual down** (only if no `staff_accounts` data relied upon):
   - Drop `staff_accounts` table and `staff_account_status` type.
   - Drop new columns on `staff` and `centres` (only if no code depends on them).

**Do not** run manual down on production without backup and a maintenance window.

---

## Pre-production approval gates

- [ ] Staging checklist completed (`docs/staging-migration-0003-checklist.md`)
- [ ] Row counts verified
- [ ] Ops smoke tests pass
- [ ] `CARER_PORTAL_ENABLED=false` on production until Phase 1 sign-off
