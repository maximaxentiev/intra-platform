# Version 2 Release Notes

Intra Platform Version 2 delivers the Ops staffing portal, Carer portal, document compliance, automated communications, operational reporting with CSV export, and prospective platform auditing.

**Latest migration:** `0014_platform_audit_events.sql`

---

## Delivered

### Staff & accounts
- Staff creation and portal invitations
- Manual account linking path
- Ops Staff detail and document review workflows

### Carer portal
- Login and session separation from Ops
- Profile onboarding (personal information)
- Document upload and replacement
- Availability management
- Shift view, acceptance, and cancellation

### Operations
- Smart shift matching (availability, overlap, buffer, bans, documents, role)
- Shift lifecycle (create, edit, assign, reassign, unassign, cancel, complete)
- Centre management (contacts, banned staff, top staff)
- Ops User invitation and administration

### Documents
- VSC, First Aid, Immunizations, optional COVID
- Review, approve, issue flag
- VSC processed date with stored renewal due (+1 calendar year)
- First Aid explicit expiry
- Mandatory expiry reminders (VSC / First Aid)
- Secure private document access

### Communications
- Assignment confirmations
- Shift reminders
- Cancellation emails
- Document expiry reminders
- Worker with retry/idempotency

### Reporting (Ops-only)
All reports use **America/Toronto** calendar semantics, standardized pagination (10/25/50), and **Export CSV** for the full filtered dataset (pagination params ignored on export).

| Report | JSON route | CSV export route |
|--------|------------|------------------|
| Shift Fulfillment | `GET /api/reports/shift-fulfillment` | `GET /api/reports/shift-fulfillment/export` |
| Centre Usage | `GET /api/reports/centre-usage` | `GET /api/reports/centre-usage/export` |
| Staff Usage | `GET /api/reports/staff-usage` | `GET /api/reports/staff-usage/export` |
| Document Compliance | `GET /api/reports/documents` | `GET /api/reports/documents/export` |
| Activity Log | `GET /api/reports/activity` | `GET /api/reports/activity/export` |

Features across reports:
- Centre / Staff multi-select
- Rule-builder metric filters (Shift Fulfillment, Centre Usage, Staff Usage)
- Document Compliance advanced filters (OR within group, AND across groups)
- Activity Log compact table with dual pagination
- Summary cards aggregate the **full filtered population**, not the current page

### Platform auditing
- Durable `platform_audit_events` table (migration 0014)
- Prospective capture for shifts, centres, users, staff, and related actions
- Activity Log union includes audit-backed events where recorded

### CSV export
- Authenticated Ops-only backend endpoints
- UTF-8 CSV with BOM, proper escaping, formula-injection mitigation
- Toronto date/timestamp formatting; scheduled hours as decimal values in Excel
- Activity Log export capped at **50,000 rows** with a clear error when exceeded (no silent truncation)
- Web **Export CSV** button disabled when zero matching rows

---

## Explicitly deferred

### Phase 8 — Hours Adjustment
Not included in Version 2:
- Actual shift hours / payroll / verified hours
- Centre adjustment links
- Adjusted hours workflows

Staff Usage and Centre Usage continue to report **Scheduled Hours** and **Scheduled Hours on Completed Shifts** only.

---

## Explicitly excluded

### Applications
Applications reporting, migration, and product work remain out of Version 2 scope.

---

## Important reporting definitions

### Fill rate
```
(filled + completed) / (pending + filled + completed)
```
Cancelled shifts are excluded from the denominator. Zero denominator → null in JSON/UI, blank in CSV. Summary fill rates use **aggregate counts**, not averages of centre percentages.

### Staff hours
- **Scheduled Hours on Completed Shifts** — included
- **Scheduled Hours on Filled Shifts** — included (Staff Usage)
- Actual / payroll / verified hours — **not included**

### VSC
- Processed Date is set on approval
- Renewal Due = stored `expiry_date` (+1 calendar year from processed date at approval time)
- Expiring Soon = within 30 calendar days inclusive

### First Aid
- Explicit stored expiry date

### COVID
- Optional; missing submission labeled **Optional — Not Submitted** in UI and CSV

### Activity Log limitation
Historical activity reflects **durable recorded events only**. Expanded platform auditing applies **prospectively**. Do not assume completeness for actions performed before audit capture was introduced. Shift comments are not exported.

---

## Technical handoff

### Services
- **API** — NestJS, port 8000, runs migrations on startup
- **Web** — TanStack Start/Vite static build
- **Worker** — required for automated communications and scheduled jobs

### Staging deployment
From repo root on the droplet (see `scripts/deploy-staging.sh`):
1. Ensure `.env` is present (see `.env.example` for variable **names**)
2. Run `./scripts/deploy-staging.sh`
3. Compose project: `intra-ops-test`
4. Script builds API, web, worker; waits for API health and worker startup
5. Optional data import via `SOURCE_DATABASE_URL` or Supabase credentials

**Do not deploy without explicit approval.** Version 2 closure commit does not imply production release.

### Production
Follow repository deployment documentation if present; same compose/migration pattern applies. Migrations run once through normal API startup.

### Rollback
Redeploy previous image/build tag. Database rollback is forward-only via migrations; test rollback on staging before production schema changes.

### Environment variables (names only)
See `.env.example`: database, Redis, session cookie, `APP_PUBLIC_URL`, `EMAIL_FROM`, document signing secret, S3/storage, feature flags such as `CARER_PORTAL_ENABLED`, etc. Never commit secret values.

### Security notes
- All report and export routes require Ops session (`SessionGuard`)
- Carer routes use separate staff session cookie
- CSV responses use `Cache-Control: private, no-store`
- Export omits storage keys, tokens, and raw metadata JSON

---

## Known limitations

1. Activity Log historical gap before platform audit rollout
2. Activity Log CSV export limit: 50,000 rows
3. No Applications reporting
4. No actual/payroll hours (Phase 8 deferred)
5. Malformed legacy shifts (`end_time <= start_time`) contribute **0** scheduled minutes but remain in shift counts
6. Overnight shifts are not supported on create/edit

---

*Version 2 reporting and hardening — Phase 9G complete.*
