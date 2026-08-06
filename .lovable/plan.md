# Intra Platform V2 — Phased Build Plan

Six phases, each independently shippable and testable. Every phase is mobile-first: no horizontal scroll, large touch targets, tables collapse to cards under 768px.

## Current state (verified)

- Database schema and migration `0003` already add: centre city + hourly rate, staff split legal names + address/city + document slug, and the `staff_accounts` table.
- The staff-portal auth API exists (separate session store/cookie, login, invite lookup, accept-invite, forgot-password, logout, session).
- Centre/staff APIs accept the new fields.
- No V2 frontend exists; `/` still redirects to the ops dashboard.
- There is **no email module** in the API at all — Phase 4 has to build it from scratch.
- Object storage service exists and is already used by Applications documents; staff documents will reuse it.

---

## Phase 1 — Entry point and login split

- Rewrite `/` as the role-choice screen: two large cards, "Childcare Centre / Ops Team" and "Independent Carer".
- Ops login stays as today; carer login is a new page hitting the staff-auth endpoints.
- Carer login lands on the portal if onboarding is complete, otherwise on the onboarding wizard.
- Add carer routes for accept-invite (from email token) and forgot/reset password.
- Route guard for the carer area, kept fully separate from the ops guard.

## Phase 2 — Centre and staff form updates (ops)

- Centre form: add City, add Hourly Rate (currency input), rename the notes field to the V2 label. Show hourly rate on the centre profile header.
- Staff form: split legal name into first/last, add address and city.
- Staff list: add Account Status and Document Status columns (card rows on mobile).
- Bulk import: CSV upload with column mapping, per-row validation preview, and an import summary listing skipped rows and reasons.

## Phase 3 — Documents and carer onboarding

- Backend: `staff_documents` table (type, file key, status pending/approved/rejected, expiry date, reviewer, review notes) plus upload/list/review endpoints on top of the existing storage service.
- Ops: document review panel on the staff profile — preview, approve, reject with reason, set expiry.
- Public shareable page at the staff `document_slug` — read-only document list, no auth, no PII beyond name and document status.
- Carer portal onboarding wizard (mandatory, resumable via `onboarding_step`):
  1. Personal info confirmation
  2. Document upload
  3. Weekly availability
- Post-onboarding portal: upcoming shifts, availability editor, documents with status, profile.

## Phase 4 — Automated communications

- New API mail module: provider adapter, templates, and a send log table so every message is auditable and retryable.
- Triggers: shift assigned, shift reminder, shift cancelled, invite, document approved/rejected, document expiring.
- Reminders and expiry checks run on the existing cron scheduler.

## Phase 5 — Smart matching and hours adjustment

- Extend available-staff selection with: availability window match, existing-shift overlap, a 2-hour travel buffer between shifts, centre ban list, and approved-documents-only.
- Ineligible carers are shown greyed with the exact reason rather than hidden.
- Hours adjustment: signed public link per shift; centre opens it, submits adjusted start/end, confirmation emails to ops and carer; shift records original vs adjusted hours.

## Phase 6 — Applications updates and reporting

- Applications: rename Hire to Accept everywhere; rejection now requires a reason chosen from a modal (preset list + free text), stored on the application and shown in the activity timeline.
- Reports section with five reports, each filterable by date range and exportable to CSV: Activity Log, Shift Fulfillment, Centre Usage, Staff Usage, Document Report.

---

## Technical notes

- Frontend: TanStack Router file routes under `apps/web/src/routes`; carer portal lives in its own route group with its own shell so ops navigation never leaks into it.
- Backend: NestJS modules per feature, Drizzle migrations, class-validator DTOs, existing Redis session pattern reused for carers.
- File uploads go through the existing storage service with server-side type/size validation; documents are served via short-lived signed URLs, never public object URLs.
- Public pages (document slug, hours adjustment) use unguessable tokens, expose no PII beyond what the spec requires, and are rate-limited.
- Each phase ends with a typecheck and a mobile pass at 390px before moving on.

## Build order note

Phase 4 depends on Phase 3's document statuses, and Phase 5's matching depends on approved documents existing. Phases 1, 2 and 6 are independent and can be reordered if you want a faster visible win.
