# Version 2 Release Notes

**Status:** Version 2 is **complete**, **deployed**, and **manually validated**.

**Live host:** [https://platform.intra.ca](https://platform.intra.ca)

**Final application commit:** `04be7c0b92aaa8c93c422e83316f0dab06a2cd40` — *Add Centre Usage shift detail*

**Latest migration:** `0014_platform_audit_events.sql` (no migrations after 0014)

Intra Platform Version 2 delivers the Ops staffing portal, Carer portal, document compliance, automated communications, operational reporting with CSV export, Centre Usage shift-level detail, and prospective platform auditing.

---

## Release closure

Version 2 scope is closed. The deployed environment at **platform.intra.ca** was manually validated, including:

- API, web, and worker services
- All five Ops reports and CSV exports
- Centre Usage Shift Detail (selected Centres, Completed default, filters, pagination, Shift Detail CSV)

Before release closure, **database backup and restore-list verification** was completed on the production database backing the live deployment.

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
| Centre Usage (summary) | `GET /api/reports/centre-usage` | `GET /api/reports/centre-usage/export` |
| Centre Usage (shift detail) | `GET /api/reports/centre-usage/shifts` | `GET /api/reports/centre-usage/shifts/export` |
| Staff Usage | `GET /api/reports/staff-usage` | `GET /api/reports/staff-usage/export` |
| Document Compliance | `GET /api/reports/documents` | `GET /api/reports/documents/export` |
| Activity Log | `GET /api/reports/activity` | `GET /api/reports/activity/export` |

Features across reports:
- Centre / Staff multi-select
- Rule-builder metric filters (Shift Fulfillment, Centre Usage, Staff Usage)
- Document Compliance advanced filters (OR within group, AND across groups)
- Activity Log compact table with dual pagination
- Summary cards aggregate the **full filtered population**, not the current page

### Centre Usage Shift Detail
Post–Version 2 reporting enhancement (included in final release commit):

- **Shift Detail** section appears when one or more Centres are explicitly selected (hidden for All Centres)
- Default status filter: **Completed**
- Independent **Status** and **Staff** filters (do not change aggregate Centre Usage summary cards)
- Independent pagination (`shiftPage` / `shiftPageSize`, default 10; 10/25/50)
- **Export Shift Detail CSV** for the full filtered shift population
- Columns: date, centre, staff, role (`roleNeeded`), status, scheduled time, **Scheduled Hours**
- Uses **Scheduled Hours** terminology only — not actual, billable, payroll, or verified hours
- Structured shift-level data suitable as a foundation for **future invoicing**; no billing rates, amounts, invoice records, or automatic invoice generation

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
Intentionally deferred — not part of Version 2:

- Actual shift hours / payroll / verified hours
- Centre adjustment links
- Adjusted hours workflows

Staff Usage and Centre Usage continue to report **Scheduled Hours** and **Scheduled Hours on Completed Shifts** only. Centre Usage Shift Detail exports scheduled duration, not worked or billable hours.

---

## Explicitly excluded

### Applications
Applications reporting, migration, and product work are **excluded** from the revised Version 2 scope.

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

### Live deployment
- **Primary host:** [https://platform.intra.ca](https://platform.intra.ca)
- **Legacy redirect host:** `ops-test.intra.ca` (redirect only; not the primary application host)
- **Docker Compose project:** `intra-ops-test`
- **Deployment script:** `scripts/deploy-staging.sh` (retained name; this is the current deployment entry point)

The Compose project name **`intra-ops-test` must not be renamed** — it owns the existing persistent database volumes and production data.

To redeploy from the repo root on the droplet:

1. Ensure `.env` is present (see `.env.example` for variable **names**; set `APP_HOST=platform.intra.ca` and `LEGACY_APP_HOST=ops-test.intra.ca`)
2. Run `./scripts/deploy-staging.sh`
3. Script builds API, web, and worker; waits for API health and worker startup
4. Migrations apply once through normal API startup
5. Optional data import via `SOURCE_DATABASE_URL` or Supabase credentials (typically not needed on an existing live database)

### Rollback
Redeploy a previous image/build tag from git. Database schema rollback is forward-only via migrations; restore from backup if a schema/data rollback is required.

### Environment variables (names only)
See `.env.example`: database, Redis, session cookie, `APP_PUBLIC_URL`, `EMAIL_FROM`, document signing secret, S3/storage, feature flags such as `CARER_PORTAL_ENABLED`, etc. Never commit secret values.

### Security notes
- All report and export routes require Ops session (`SessionGuard`)
- Carer routes use separate staff session cookie
- CSV responses use `Cache-Control: private, no-store`
- Export omits storage keys, tokens, and raw metadata JSON

---

## Post-release security action

Previously exposed environment credentials **must be rotated** as operational security work. This is not a Version 2 product feature and does not require an application release.

- Rotate affected secrets in the hosting environment and `.env` on the droplet
- Update dependent services (database, Redis, email, object storage, signing secrets, API keys) as applicable
- **Do not** record credential values in this repository or in release notes

---

## Known limitations

1. Activity Log historical gap before platform audit rollout
2. Activity Log CSV export limit: 50,000 rows
3. No Applications reporting
4. No actual/payroll hours (Phase 8 deferred)
5. No automatic invoicing or Centre hourly-rate billing calculations
6. Malformed legacy shifts (`end_time <= start_time`) contribute **0** scheduled minutes but remain in shift counts
7. Overnight shifts are not supported on create/edit

---

*Version 2 — complete, deployed to platform.intra.ca, validated.*
