# Childcare Staffing Ops Platform — V1 MVP Plan

## Stack & Foundation
- TanStack Start (existing template) + Tailwind + shadcn/ui
- **Lovable Cloud** (Supabase) for auth, database, RLS
- All ops users are equal — any authenticated user can read/write everything

## Database Schema (Lovable Cloud migration)

```text
profiles              (id → auth.users, full_name, email)
staff                 (id, legal_name, display_name, use_display_name,
                       phone, email, role, status[active|inactive],
                       notes, documents_url, created_at)
centres               (id, name, address, contact_name, contact_title,
                       contact_phone, contact_email,
                       preferred_channel[whatsapp|goto|email], notes)
staff_centre_top      (staff_id, centre_id)        -- two-way sync surface
staff_centre_banned   (staff_id, centre_id)        -- two-way sync surface
availability          (id, staff_id, week_start_date, day_of_week 0-6,
                       start_time, end_time)       -- multiple rows/day OK
shifts                (id, centre_id, shift_date, start_time, end_time,
                       role_needed, notes, status[pending|filled|
                       cancelled|completed], assigned_staff_id nullable,
                       cancellation_reason, created_at)
shift_contacted       (shift_id, staff_id, contacted_at)
```

- RLS: authenticated users full access; user_roles table not needed in V1.
- Two-way sync: the `staff_centre_top` / `_banned` tables ARE the shared source. Both the staff profile UI and centre profile UI read/write the same rows — sync is automatic by design (no triggers needed).
- Auto-complete rule: a Postgres function + pg_cron job every minute flips `filled` shifts past their end datetime to `completed`. Also enforced defensively on read.

## Routes

```text
/auth                          — login + signup (email/password)
/_authenticated/
  index                        — Dashboard
  staff                        — Staff directory (search, filter status/role)
  staff/$id                    — Staff profile (tabs: Details, Availability,
                                 Shifts, Top/Banned centres)
  staff/new
  centres                      — Centre directory (search)
  centres/$id                  — Centre profile (tabs: Details, Top/Banned
                                 staff, Shifts)
  centres/new
  shifts                       — Master shift list (filter date range,
                                 centre, status, assigned staff)
  shifts/new
  shifts/$id                   — Shift record + Available Staff panel
                                 (Top-first, badge, Contacted toggle,
                                 Assign button)
  availability                 — Team-wide availability dashboard
                                 (filter date/day/time slot)
  profile                      — Edit own name/email
```

## Key Feature Details

**Available Staff list on shift record**
1. Query all active staff.
2. Exclude staff in `staff_centre_banned` for that centre.
3. Exclude staff assigned to any other shift overlapping the date/time.
4. (Optional soft signal) staff with availability covering the window shown first among non-top; V1 keeps everyone eligible per spec — spec only mandates banned + conflict exclusions.
5. Sort: Top staff (starred badge) first, then remaining alphabetical.
6. Each row: ⭐ badge if top, Contacted checkbox (persists to `shift_contacted`), Assign button (one click → sets `assigned_staff_id`, status→`filled`).

**Dashboard tiles** (all clickable → filtered shift list / availability page)
- Shifts this week (count)
- Pending shifts (count)
- Filled shifts (count)
- Staff available today (list)

**Availability**
- Per-staff: weekly grid Mon–Sun, week navigator (prev/this/next/any), add multiple ranges per day.
- Team-wide: table of active staff × selected date/week, filter by day + time slot.

## Design
Clean, professional, uncluttered. High-contrast neutral palette with one accent for primary actions. Large tap targets, plain-language button labels ("Create shift", "Assign to shift", "Mark contacted"). Sidebar nav with Dashboard, Shifts, Staff, Centres, Availability. Desktop-first, tablet-responsive. shadcn Table/Dialog/Form primitives; no fancy animation.

## Out of scope (V1)
- Role hierarchy / permissions
- Staff-facing portal
- Notifications / SMS / WhatsApp integrations
- File uploads (documents are just a URL field)
- Payments, timesheets, invoicing

## Build order
1. Enable Lovable Cloud, run schema migration + RLS + pg_cron auto-complete
2. Auth pages + protected layout + sidebar shell + own-profile edit
3. Centres CRUD + directory
4. Staff CRUD + directory (with Top/Banned multi-selects wired to centres)
5. Availability (per-staff editor + team-wide view)
6. Shifts (create, list with filters, shift record with Available Staff panel, Contacted, Assign, status transitions, cancellation reason)
7. Dashboard tiles wired to filtered views
8. Polish: empty states, loading, confirmations, tablet layout

Approve and I'll start building.