# Polish Staff directory and CSV import UI

Frontend-only refinement. No API, CSV parsing, validation, duplicate, invitation, auth, or audit changes.

## 1. Staff directory (`staff.index.tsx`)

Replace the card grid with an operational list.

- Keep heading, subtitle, Import CSV and Add Staff buttons unchanged.
- Filter bar: Search, Employment Status, Role (existing), plus a new **Portal Account** filter built purely from the `portalAccountStatus` field already returned by `staffApi.list()` (options: All, No Account, Invited, Incomplete, Active, Disabled). Filtering stays client-side like the current filters.
- Desktop/tablet (`md+`): dense table with columns Name, Role, Phone, Email, Employment Status, Portal Account, Actions.
  - Name: bold, clickable link to `/staff/$id`.
  - Role: normalized value; blank renders muted "No role assigned".
  - Phone: rendered as-is (leading `+` preserved), `whitespace-nowrap` with `tabular-nums`.
  - Email: truncated with `title` attribute for the full value plus a `sr-only` full text so it is accessible, not hover-only for keyboard users.
  - Employment Status: existing `StatusBadge`.
  - Portal Account: existing `PortalStatusBadge`.
  - Actions: single "View" link-button to the profile. No new destructive actions.
- Mobile (`< md`): the same rows render as compact stacked list items — name + role on line one, employment and portal badges on line two, phone/email on line three, View as a full-width-friendly tap target. No horizontal scroll.
- Keep the existing "Showing X of Y staff", loading skeletons, and both empty states (no staff / no match) with the same copy behaviour.

## 2. CSV import page (`staff.import.tsx`)

Behaviour, API calls, filters, and confirmation dialogs stay exactly as they are.

- **Upload card**: clearer hierarchy — required columns as a compact chip/list, explicit limits (max 500 rows, 512 KB) shown before upload using the same `preview.limits` values where available and static copy otherwise, selected filename with a "Replace file" / "Remove" control that just resets the same state already used. Selecting a file still only previews.
- **Preview summary**: four compact metric cards (Total, Valid, Invalid, Duplicate) with short helper text ("will be imported", "need attention", "already exist"). Values come from `preview.summary` unchanged.
- **Preview table**: keeps Row, Name, Role, Email, Phone, Status, Issues. Status badges gain an icon so invalid/duplicate are distinguishable without colour; invalid/duplicate rows get a left accent border. Issues stay inline and wrapped — never a tooltip. Long email/phone wrap with `break-all`. Filters stay directly above the table with counts.
- **Import actions**: grouped in a footer bar. "Import staff only" as primary with a note that no emails are sent; "Import and send portal invitations" as secondary with an explicit email warning and mail icon. Both keep the existing disabled condition (`preview.summary.valid === 0` or loading) and the existing confirm dialog; the confirm action shows a spinner and is disabled while processing.
- **Results**: keep the persistent results card. Summary rendered as grouped metrics with failures/invitation failures visually flagged when non-zero. Row-level table keeps Row, Email, Phone, Outcome, Notes. Header banner reflects the real outcome — if `failed > 0` or `invitationEmailFailures > 0` it reads as partial success, not success. Keep "Return to staff list".
- **Feedback**: preserve existing `toast.error` calls for preview/import failures, and additionally surface the error inline in the upload card so it is not lost when the toast dismisses. Success toast only when there are no failures.

## 3. Responsiveness

Verify 375 / 768 / desktop for directory, filters, upload, preview metrics, preview rows, results, dialogs. No unintended horizontal scroll; tables stay dense on desktop.

## 4. Verify

- `vitest` for `staff-portal-ui.spec.ts` and `staff-csv-import-ui.spec.ts` (both assert strings this plan preserves).
- TypeScript check and production build.
- Confirm no backend/migration files touched and the carer portal flag stays off.

## Technical notes

- Files changed: `apps/web/src/routes/_authenticated/staff.index.tsx`, `apps/web/src/routes/_authenticated/staff.import.tsx`, plus possibly a small `apps/web/src/components/StaffTable.tsx` extraction if the index file gets long. `PortalStatusBadge` and `portal-account-status.ts` are reused as-is.
- No new dependencies. All colour comes from existing semantic tokens.
- Git note: branch sync, commits, and pushes are handled by the platform's own version control rather than by me running git commands; I will report the file-level changes and verification output.
