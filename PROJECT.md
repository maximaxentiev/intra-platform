# PROJECT.md

Permanent source of truth for the **Intra Platform** (Ops Portal) — a childcare staffing operations platform.

> **Maintenance rule:** Update this document after every completed development session. Add entries to **Recent Changes**, move items between **Features Completed**, **Features In Progress**, and **Known Issues** as work progresses.

---

# Project Overview

This is **Version 1 (MVP)** of an internal childcare staffing operations portal. The goal is to move the fulfillment team off unstructured Excel sheets into a single centralized platform.

**Who uses it:** Internal operations team members only. All users have the same access level in V1 — there is no role hierarchy. Every ops user can see and do everything within the platform.

**What it manages:**

- Ops team user accounts and profiles
- Childcare staff profiles
- Childcare centre profiles
- Weekly staff availability
- Shift creation, assignment, and tracking
- Top Staff / Banned Staff relationships between staff and centres (two-way sync)

**Primary workflows:**

1. Create a shift for a centre
2. View eligible available staff (excluding banned and double-booked)
3. Mark staff as contacted
4. Assign staff to fill the shift

The interface is designed to be simple and fast — minimal training required.

---

# Current Architecture

## Frontend

| Layer | Technology |
|---|---|
| Framework | TanStack Start (React 19 + Vite) |
| Routing | TanStack Router (file-based routes in `src/routes/`) |
| Data fetching | TanStack Query (client-side cache) |
| UI | Tailwind CSS 4 + shadcn/ui (Radix primitives) |
| Forms | Controlled React state (plain inputs + Select components) |

**Pattern:** Client-heavy SPA for authenticated pages. The `_authenticated` layout sets `ssr: false`. Domain CRUD is performed **directly from the browser** via the Supabase JS client — there is no custom REST API layer for staff, centres, shifts, or availability.

**Key directories:**

```
src/
├── routes/              # Pages (TanStack file-based routing)
├── components/          # Feature components (StaffForm, CentreForm, AvailabilityEditor, etc.)
│   └── ui/              # shadcn/ui primitives
├── lib/                 # Domain types, date/time helpers, error handling
├── hooks/               # useAuth, useMobile
└── integrations/supabase/  # Supabase client, auth middleware, generated types
```

## Backend

- **Supabase** provides PostgreSQL database, authentication, and Row Level Security (RLS).
- All domain tables grant full CRUD to authenticated users (flat access for V1).
- A `pg_cron` job runs every minute to auto-complete filled shifts whose end datetime has passed.

## Authentication

1. Entry point: `/auth` (sign in / create account tabs).
2. Guard: `src/routes/_authenticated/route.tsx` runs `beforeLoad`, checks `supabase.auth.getUser()`, redirects to `/auth` if unauthenticated.
3. Signup stores `full_name` in user metadata; a DB trigger auto-creates a `profiles` row.
4. Session persisted in `localStorage` with auto-refresh.
5. Users edit their own profile at `/profile` (RLS enforces `auth.uid() = id`).
6. `attachSupabaseAuth` middleware attaches Bearer tokens for server functions (domain CRUD is mostly client-side today).

## Routing

| URL | Purpose |
|---|---|
| `/` | Redirects to `/dashboard` |
| `/auth` | Login / signup |
| `/dashboard` | Summary stats + staff available today |
| `/staff` | Staff directory |
| `/staff/new` | Create staff |
| `/staff/:id` | Staff detail (Details, Top/Banned Centres, Availability, Shifts tabs) |
| `/centres` | Centre directory |
| `/centres/new` | Create centre |
| `/centres/:id` | Centre detail (Details, Top/Banned Staff, Shifts tabs) |
| `/shifts` | Master shift list with filters |
| `/shifts/new` | Create shift |
| `/shifts/:id` | Shift detail + available staff list |
| `/availability` | Team-wide availability dashboard |
| `/profile` | Ops user profile |

Layout: `__root.tsx` → `_authenticated/route.tsx` (auth guard + `AppShell` sidebar) → feature routes.

## Database

- Initial migration: `supabase/migrations/20260702203952_7de4af9e-c0e7-46be-aee8-691d7d5fbb19.sql`
- Ops feedback migration: `supabase/migrations/20260707130000_ops_feedback_db_features.sql`
- Domain types and helpers: `src/lib/db.ts`
- Generated Supabase types in `src/integrations/supabase/types.ts` (may be stale; `db.ts` uses a cast workaround)

## Deployment

- Connected to **[Lovable](https://lovable.dev)** — pushes to the connected branch sync back to the Lovable editor.
- Built with `@lovable.dev/vite-tanstack-config` (TanStack Start + Nitro).
- SSR error wrapper: `src/server.ts`
- **Do not force-push or rewrite published git history** — see `AGENTS.md`.

Environment variables (via Lovable Cloud / Supabase):

- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`

---

# Database Overview

## `profiles`

Ops team member accounts linked to Supabase Auth.

- **Primary key:** `id` (matches `auth.users.id`)
- **Fields:** `full_name`, `email`, timestamps
- **Created automatically** on signup via `handle_new_user()` trigger

## `staff`

Childcare staff directory entries (not login users).

- **Fields:** `legal_name`, `display_name`, `use_display_name`, `phone`, `email`, `role` (ECA or ECE), `status` (active/inactive), `notes`, `documents_url`
- **Display name logic:** If `use_display_name` is true and `display_name` is set, show display name everywhere; otherwise show legal name

## `centres`

Childcare centre directory entries.

- **Fields:** `name`, `address`, `primary_channel`, `preferred_channel` (legacy, kept in sync), `notes`
- **Legacy flat contact fields** (`contact_name`, etc.) remain on the table but UI uses `centre_contacts` instead

## `centre_contacts`

Multiple contacts per centre with priority ordering.

- **Fields:** `centre_id`, `name`, `title`, `email`, `phone`, `sort_order` (0 = primary)
- **Migration:** Existing flat contact fields backfilled into first contact row

## `centre_secondary_channels`

Secondary communication channels per centre (multi-select).

- **Composite key:** `(centre_id, channel)`
- Primary channel stored on `centres.primary_channel`; secondary must not duplicate primary (app-enforced)

## `staff_centre_top`

Junction table — which staff are **Top Staff** at which centres.

- **Composite key:** `(staff_id, centre_id)`
- **Two-way sync:** Updating Top Staff on a centre profile or Top Centres on a staff profile writes to this same table

## `staff_centre_banned`

Junction table — which staff are **banned** from which centres.

- **Composite key:** `(staff_id, centre_id)`
- **Two-way sync:** Same shared table from either staff or centre side
- **Business rule (app-enforced):** A staff–centre pair cannot be in both Top and Banned; adding to one removes from the other

## `availability`

Weekly availability time ranges per staff member.

- **Fields:** `staff_id`, `week_start_date` (Monday), `day_of_week` (0=Mon … 6=Sun), `start_time`, `end_time`
- Multiple ranges allowed per day

## `shifts`

Shift records.

- **Fields:** `centre_id`, `shift_date`, `start_time`, `end_time`, `role_needed` (ECA or ECE), `notes`, `status` (pending / filled / cancelled / completed), `assigned_staff_id`, `cancellation_reason`, `added_to_staffpoint` (boolean, default false)
- **Auto rule:** Filled shifts auto-change to Completed when end datetime passes (pg_cron)

## `shift_comments`

Internal ops comments on a shift.

- **Fields:** `shift_id`, `author_id` → `profiles`, `body`, `created_at`
- Displayed on shift detail with author name and timestamp

## `shift_contacted`

Tracks which staff were marked "Contacted" on a shift's available staff list.

- **Composite key:** `(shift_id, staff_id)`

---

# Features Completed

## Authentication & users
- [x] Sign up / sign in for ops team members
- [x] Flat access (no role hierarchy)
- [x] User profile page (edit name and email)
- [x] Auth guard on all authenticated routes
- [x] Redirect `/` → `/dashboard`

## Staff management
- [x] Staff directory with search (name) and filters (status, role)
- [x] Create, view, edit, delete staff profiles
- [x] Legal name + optional display name
- [x] Role dropdown: ECA / ECE only
- [x] Optional documents link (any text, no URL validation)
- [x] Top Centres and Banned Centres multi-select with two-way sync
- [x] Top/Banned mutual exclusion (UI + DB updates)
- [x] Per-staff weekly availability editor (redesigned layout)
- [x] Per-staff shift history tab

## Centre management
- [x] Centre directory with name search
- [x] Create, view, edit, delete centre profiles
- [x] Primary + secondary communication channels
- [x] Multiple sortable centre contacts (name, title, email, phone)
- [x] Top Staff and Banned Staff multi-select with two-way sync
- [x] Top/Banned mutual exclusion
- [x] After create → centre detail on **Top & Banned Staff** tab
- [x] Per-centre shift history tab
- [x] Centre Shifts tab: cancelled badge matches main Shifts list (red “cancelled” only)

## Availability
- [x] Per-staff weekly availability editor (horizontal scroll, vertical day cards, blur-to-save times)
- [x] Warm styling for active time-range cards; grey for past
- [x] Per-staff availability: calendar jump-to-date + optional date range (no schema change)
- [x] Team-wide availability dashboard
- [x] Filter by day, specific date, time range (From / optional To)
- [x] Clear filters button
- [x] Date filter syncs with week navigation
- [x] Past availability badges greyed on team dashboard

## Shift management
- [x] Create shift (saves as Pending without assignee)
- [x] Shift detail with edit, status change, cancellation reason
- [x] Available staff list: excludes banned + overlapping shifts
- [x] Top staff sorted first with star indicator
- [x] Filter available staff by shift role (ECA / ECE)
- [x] Contacted toggle per staff on shift
- [x] One-click Assign → status Filled
- [x] Green assigned-staff indicator on shift detail (row highlight + badge)
- [x] Searchable centre dropdown on shift create/edit
- [x] Clear filters on master Shifts list
- [x] Added to Staffpoint Yes/No field (create, edit, list column, filter)
- [x] Internal shift comments with author and timestamp
- [x] Auto-complete filled shifts after end time (pg_cron)
- [x] Master shift list with date range, centre, status, staff filters
- [x] Past-due shifts greyed in master list
- [x] Dashboard summary cards with links to filtered views

## Design & UX
- [x] AppShell sidebar navigation (desktop + mobile)
- [x] shadcn/ui component library
- [x] Toast notifications (Sonner)

---

# Features In Progress

None — ops feedback Phase 1 (frontend) and Phase 2 (database) are complete pending deploy/migration on Supabase.

---

# Ops Team Feedback Plan

Feedback received July 7, 2026. Delivery split into **two phases**: (1) frontend quick fixes, (2) database-backed features together.

## Phase 1 — Frontend quick fixes ✅ COMPLETE

| # | Request | Status | Files |
|---|---|---|---|
| 3 | Centre Shifts tab: cancelled badge matches main list | ✅ Done | `centres.$id.tsx` |
| 4 | Staff Availability: calendar jump + optional date range | ✅ Done | `AvailabilityEditor.tsx` |
| 5 | Searchable centre dropdown on shift create/edit | ✅ Done | `SearchableCentreSelect.tsx`, `shifts.new.tsx`, `shifts.$id.tsx` |
| 6 | Clear filters on master Shifts list | ✅ Done | `shifts.index.tsx` |
| 9 | Green assigned staff indicator on shift detail | ✅ Done | `shifts.$id.tsx` |

## Phase 2 — Database-backed features ✅ COMPLETE

| # | Request | Status | Migration / files |
|---|---|---|---|
| 7 | Added to Staffpoint on shifts | ✅ Done | `20260707130000_...sql`, shift routes |
| 2 | Primary + secondary communication channels | ✅ Done | `centre_secondary_channels`, `CentreForm`, `ChannelMultiSelect` |
| 1 | Multiple sortable centre contacts | ✅ Done | `centre_contacts`, `CentreContactsEditor` |
| 8 | Internal shift comments | ✅ Done | `shift_comments`, `ShiftComments` |

**Deploy note:** Run the new migration on Supabase (Lovable Cloud) before testing in production.

## 1. Frontend-only quick fixes

*(Phase 1 complete — kept for reference.)*

| # | Request | Primary files | Notes |
|---|---|---|---|
| 3 | Centre Shifts tab: cancelled shifts should match main Shifts page | `centres.$id.tsx` | ✅ |
| 5 | Searchable centre dropdown when creating/editing a shift | `SearchableCentreSelect.tsx`, `shifts.new.tsx`, `shifts.$id.tsx` | ✅ |
| 6 | “Clear all filters” on master Shifts list | `shifts.index.tsx` | ✅ |
| 9 | Assigned staff on shift detail should be clearly green | `shifts.$id.tsx` | ✅ |

## 2. Small database-backed features

Single migration or small schema addition. Moderate scope, isolated domains.

| # | Request | Schema change | Primary files |
|---|---|---|---|
| 7 | “Added to Staffpoint” Yes/No on shifts (default No); column in table + filter | Add `added_to_staffpoint BOOLEAN NOT NULL DEFAULT false` on `shifts` | Migration, `shifts.new.tsx`, `shifts.$id.tsx`, `shifts.index.tsx`, `lib/db.ts` |
| 2 | Primary communication channel (single-select) + secondary channels (multi-select, excludes primary) | Rename/repurpose `preferred_channel` → primary; add `centre_secondary_channels` junction table or `secondary_channels centre_channel[]`; migrate existing data | Migration, `CentreForm.tsx`, `centres.$id.tsx`, `centres.index.tsx`, `lib/db.ts` |

**Estimated effort:** ~1–2 days total

## 3. Larger database-backed features

New tables, more UI surface, data migration from existing flat fields.

| # | Request | Schema change | Primary files |
|---|---|---|---|
| 1 | Multiple contacts per centre (name, email, phone, role/title) with priority ordering | New `centre_contacts` table (`centre_id`, `name`, `email`, `phone`, `title`, `sort_order`); migrate then deprecate `contact_*` columns on `centres` | Migration, `CentreForm.tsx`, new contact editor component, `centres.$id.tsx`, `centres.index.tsx` |
| 8 | Internal comments on shift detail (author, date/time timestamp) | New `shift_comments` table (`shift_id`, `author_id` → `profiles`, `body`, `created_at`) | Migration, `shifts.$id.tsx`, new comments component, `lib/db.ts` |

**Estimated effort:** ~3–5 days total

## Frontend-only (medium effort, no migration)

| # | Request | Primary files | Notes |
|---|---|---|---|
| 4 | Staff Availability tab: calendar icon to jump to a date; optional date range | `AvailabilityEditor.tsx` | ✅ Done — calendar popover, From/To date inputs, range highlighting, week nav clamped to range |

**Estimated effort:** ~1 day

---

## Safest implementation order

```
Phase 1 — Frontend quick fixes (no DB)                    ✅ COMPLETE
Phase 2 — Database-backed features                        ✅ COMPLETE
  #7 Staffpoint → #2 Channels → #1 Contacts → #8 Comments (single migration)
```

### Rationale (Phase 2)

1. **#7 first** — single boolean column; establishes filter + column patterns.
2. **#2 before #1** — smaller centre change; avoids rebuilding channel UI when contacts land.
3. **#8 before #1** — shift-only feature; isolated from centre profile rewrite.
4. **#1 last** — replaces flat contact fields; highest migration risk.

*(Original six-phase plan merged into two delivery phases per team decision.)*

### Per-item testing (when implemented)

| Item | Verify |
|---|---|
| 3 | Future cancelled shift on centre tab shows red “Cancelled” only |
| 4 | Calendar picks date → correct week loads; range spans multiple weeks if supported |
| 5 | Type in centre name on shift create/edit filters list |
| 6 | Clear all filters resets dates, centre, status, staff |
| 7 | Staffpoint defaults No; filter and table column work |
| 8 | Comment shows author name + timestamp; persists on refresh |
| 9 | Assigned staff row/button is green and obvious |
| 1 | Add/reorder/delete contacts; priority order saved |
| 2 | Primary single; secondary multi; primary excluded from secondary |

---

# Roadmap

## Ops feedback (see **Ops Team Feedback Plan** above)

- Phase 1 (frontend quick fixes): **complete**
- Phase 2 (database-backed): **complete** — migration required on Supabase

## P2 — Spec polish (remaining from original review)

- [ ] Searchable staff dropdown on shift list filter
- [ ] DB constraint preventing same staff–centre in both top and banned tables
- [ ] Optionally factor staff availability into shift available-staff list
- [ ] Regenerate Supabase TypeScript types (remove `db.ts` cast)
- [ ] Signup auto-login or clearer messaging if email confirmation is required
- [ ] Split upcoming vs past shifts on staff/centre detail tabs

## P3 — Nice-to-have

- [ ] Client-side fallback for shift auto-complete (belt-and-suspenders if pg_cron unavailable)
- [ ] Shared hooks for repeated Supabase queries (`useCentres`, `useActiveStaff`)
- [ ] Tablet UX pass on availability editor
- [ ] Upcoming vs past shift sections on detail pages

---

# Known Issues

| Issue | Severity | Notes |
|---|---|---|
| Supabase generated types are stale | Low | `src/lib/db.ts` casts client to `any`; regenerate types from schema |
| Signup does not auto-sign-in | Low | Shows "You can now sign in"; email confirmation may block login if enabled in Supabase |
| Shift available staff ignores weekly availability | Medium | Filters by role, banned, overlap — but not whether staff marked availability for that date/time |
| Legacy free-text roles on old records | Low | Pre-ECA/ECE data won't appear in role-filtered shift staff lists until updated |
| Centre/staff dropdowns not searchable | Low | Shift create/edit centre dropdown is searchable; staff filter on shift list still plain Select |
| `package-lock.json` untracked | Low | Exists locally but not in repo |
| Lovable git history constraint | Ops | No force-push or history rewrite on connected branch |

---

# Future Ideas

*(Ops feedback database features are now implemented — see Features Completed.)*

- Role hierarchy and permissions (centre managers, read-only users, etc.)
- Staff self-service portal (staff log in to set their own availability)
- SMS / WhatsApp / GoTo integration from the Contacted flow
- Push notifications for pending shifts
- Reporting and export (CSV/PDF shift reports)
- Audit log of who changed what
- Recurring shift templates
- Distance/travel-time sorting for available staff
- Document upload (not just link) for compliance files
- Multi-location org support

---

# Testing Checklist

## Authentication
- [ ] Sign up with name, email, password
- [ ] Sign in redirects to dashboard
- [ ] Sign out returns to `/auth`
- [ ] Unauthenticated users cannot access `/dashboard`
- [ ] Edit profile name/email saves correctly

## Staff
- [ ] Create staff with ECA or ECE role
- [ ] Search and filter staff directory
- [ ] Display name checkbox works
- [ ] Save optional documents link (plain text OK)
- [ ] Add/remove Top Centres and Banned Centres
- [ ] Confirm Top/Banned mutual exclusion both ways
- [ ] Delete staff removes profile and associations

## Centres
- [ ] Create centre → lands on Top & Banned Staff tab
- [ ] Set primary + secondary communication channels (primary excluded from secondary)
- [ ] Add/reorder/delete multiple contacts; first contact = primary
- [ ] Edit centre details
- [ ] Add/remove Top Staff and Banned Staff
- [ ] Confirm Top/Banned mutual exclusion
- [ ] Delete centre (blocked if shifts reference it)
- [ ] Cancelled shifts on centre Shifts tab show red “cancelled” badge only (no “Upcoming · Cancelled”)

## Availability (per staff)
- [ ] Navigate between weeks
- [ ] Jump to date via calendar popover
- [ ] Set From / To date range; days outside range de-emphasized; week arrows clamped to range
- [ ] Add multiple time ranges per day without overlap UI bugs
- [ ] Edit times (double-digit hours) — saves on blur
- [ ] Remove time ranges
- [ ] Past days/ranges appear greyed

## Shifts (continued)
- [ ] Searchable centre dropdown on create/edit
- [ ] Clear filters resets all shift list filters
- [ ] Assigned staff on shift detail has green row + badge
- [ ] Staffpoint defaults to No on create; editable on detail
- [ ] Staffpoint column and filter on master list
- [ ] Add internal comment — shows author + timestamp; persists on refresh

## Availability (team dashboard)
- [ ] View all active staff for a week
- [ ] Filter by day, specific date, time From only
- [ ] Filter by time From + To range
- [ ] Clear filters resets all fields and week
- [ ] Date picker jumps to correct week
- [ ] Past availability badges greyed

## Shifts
- [ ] Create shift with centre, date, times, ECA/ECE role
- [ ] Available staff excludes banned and double-booked
- [ ] Available staff filtered by role
- [ ] Top staff appear first with star
- [ ] Toggle Contacted persists
- [ ] Assign staff → status Filled
- [ ] Edit shift fields
- [ ] Cancel with optional reason
- [ ] Filled shift auto-completes after end time
- [ ] Master list filters work (date, centre, status, staff)
- [ ] Past-due shifts greyed in list
- [ ] Dashboard stats link to filtered views

---

# Recent Changes

### Session: July 7, 2026

**Committed & pushed (`de55635` — "Improve availability editor layout and styling"):**

- Staff role dropdown: ECA / ECE only
- Shift role needed dropdown: ECA / ECE only
- Available staff list filtered by matching role
- Top/Banned mutual exclusion on staff and centre profiles
- Availability editor layout overhaul (horizontal scroll, vertical day cards, blur-to-save)
- Warm `#fff4db` styling for active time-range cards; grey for past

**Implemented locally (pending commit):**

- Team availability: Clear filters button
- Team availability: Date filter ↔ week navigation sync
- Team availability: Past availability badge greying
- Master shift list: Past-due row greying
- Staff documents link: optional, any text (removed URL validation)
- Centre create: redirect to detail on Top & Banned Staff tab
- Team availability: Time filter changed to From + optional To range

**Ops feedback Phase 1 — frontend quick fixes:**

- Centre Shifts tab: cancelled badge matches main Shifts list
- `SearchableCentreSelect` component; used on shift create/edit
- Clear filters button on master Shifts list
- Green assigned-staff row + badge on shift detail
- Staff Availability: calendar jump-to-date, From/To date range, range-aware week navigation

**Ops feedback Phase 2 — database features (implemented locally, pending commit):**

- Migration `20260707130000_ops_feedback_db_features.sql`
- Staffpoint field on shifts (create, edit, list, filter)
- Multiple centre contacts with priority ordering
- Primary + secondary communication channels
- Internal shift comments on shift detail

---

*Last updated: July 7, 2026*
