# Intra Platform Version 2 — implementation roadmap

Phase 0 (this release) stabilizes the existing carer portal **foundation** only. Later phases are defined here; **do not implement them until the prior phase is approved.**

| Phase | Scope | Out of scope until started |
|-------|--------|----------------------------|
| **0** | Tests, migration audit, feature flag, token hygiene, dev scripts | Product features |
| **1** | Staff creation + invitations | Onboarding, documents |
| **2** | Profile onboarding (step 1) | Documents upload |
| **3** | Documents (step 2) | Availability |
| **4** | Availability + onboarding completion (step 3) | Shifts UI |
| **5** | Carer shifts (view/accept) | Centre matching |
| **6** | Centre data + matching rules | Automated email |
| **7** | Automated communications (invite, reset, notifications) | Hours adjustment |
| **8** | Hours adjustment workflows | Applications/reporting |
| **9** | Applications + reporting extensions | — |

---

## Phase 1 — Staff creation and invitations

**Goal:** Ops can create a carer portal login from the ops UI when inviting/linking staff.

- Ops action: create or link `staff_accounts` when a staff member should access the portal.
- Issue invite token; deliver invite URL via secure channel (manual copy in staging until Phase 7).
- API: admin-only endpoints (reuse ops session + roles).
- Enforce `CARER_PORTAL_ENABLED=true` on staging before external invites.
- Acceptance: invite link opens `/carer/invite/:token`, password set, lands in onboarding or home per status.

---

## Phase 2 — Profile onboarding

**Goal:** Step 1 of onboarding is functional (name, phone, address, city).

- Carer can edit fields stored on `staff` + account metadata.
- API: PATCH carer profile under staff session.
- Validation aligned with ops staff DTOs.
- Acceptance: onboarding step advances from 1 → 2 when valid.

---

## Phase 3 — Documents

**Goal:** Step 2 — upload/manage carer documents (certifications, clearances).

- Reuse or extend object storage patterns from applications.
- Carer-scoped upload/list; ops visibility unchanged or extended as specified.
- Optional `document_slug` public share page (if in product spec).
- Acceptance: step 2 completable; files stored with audit trail.

---

## Phase 4 — Availability and onboarding completion

**Goal:** Step 3 — carer weekly availability; mark onboarding complete.

- Carer edits own availability (subset of ops availability model).
- Set `onboarding_completed_at` when all steps satisfied.
- Acceptance: `/carer` accessible only after completion; redirect rules match API.

---

## Phase 5 — Carer shifts

**Goal:** Carer home shows real assigned/upcoming shifts.

- Read-only (or limited action) shift APIs scoped to `staffId` from session.
- No ops workflow changes unless specified.
- Acceptance: assigned shifts visible; placeholders removed.

---

## Phase 6 — Centre data and matching

**Goal:** Centre fields (e.g. city, hourly rate) feed matching/eligibility for carers.

- Ops UI for new centre columns where missing.
- Matching rules documented and tested.
- Acceptance: data used in shift/carer eligibility without breaking ops.

---

## Phase 7 — Automated communications

**Goal:** Email (or approved provider) for invites, password reset, key notifications.

- Use platform public URL helpers; no tokens in logs.
- Templates and retry policy.
- Wire `requestPasswordReset` and invite issuance to mailer.
- Acceptance: forgot-password and invite emails received in staging.

---

## Phase 8 — Hours adjustment

**Goal:** Post-shift hours adjustment workflow (product-defined).

- API + ops/carer UI as per spec.
- Audit log entries.

---

## Phase 9 — Applications and reporting

**Goal:** Carer/application reporting extensions (product-defined).

- Cross-link application pipeline to staff records where approved.
- Reporting exports/dashboards.

---

## Feature flag (all phases)

- **`CARER_PORTAL_ENABLED`** (API) and **`VITE_CARER_PORTAL_ENABLED`** (web build) default **false** in production until ops explicitly enables controlled staging/production pilots.
- Ops portal behaviour must not depend on the flag.

---

## References

- Migration audit: `docs/migration-0003-audit.md`
- Staging apply checklist: `docs/staging-migration-0003-checklist.md`
- Local carer testing (no token logging): `docs/staff-portal-dev-workflow.md`
