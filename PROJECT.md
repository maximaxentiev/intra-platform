# PROJECT.md

Permanent source of truth for the **Intra Platform** (Ops Portal) — a childcare staffing operations platform.

> **Maintenance rule:** Update this document after every completed development session.

---

# Project Overview

**Version 1 (MVP)** — internal childcare staffing operations portal for the fulfillment team.

- **Users:** Ops team only; flat access (no role hierarchy in V1). Admins can invite/deactivate users.
- **Manages:** Staff, centres, weekly availability, shifts, Top/Banned relationships.
- **Core workflow:** Create shift → view eligible staff → mark contacted → assign.

---

# Current Architecture

> **Stack rewrite in progress** (branch `stack-rewrite`): exiting Supabase/Lovable for a
> self-hosted NestJS + Drizzle + Postgres + Redis stack in a monorepo. `main` still runs the
> legacy Supabase build; the new stack lives on the branch until data cutover.

**Monorepo layout**

| Path | Contents |
|---|---|
| `apps/web` | TanStack Start (React 19 + Vite), TanStack Router/Query, Tailwind 4, shadcn/ui |
| `apps/api` | NestJS 11 (Express) + Drizzle ORM + node-postgres + ioredis, Swagger at `/api/docs` |
| `docker-compose.yml` | web + api + postgres + redis behind Traefik (same-origin `/api` routing) |
| `.env.example` | env template (real secrets are gitignored / host-only) |

**API surface** — cookie-session auth (invite-only, Redis-backed), global `SessionGuard` +
`RolesGuard`. Modules: `auth`, `users` (profiles/admin), `staff`, `centres`
(contacts/channels/top-banned), `availability`, `shifts` (assign/status/available-staff/
contacted/comments), `dashboard`. Shift auto-complete runs via `@nestjs/schedule` (replaces
pg_cron). Drizzle schema: `apps/api/src/db/schema.ts`; migrations in `apps/api/drizzle/`.

**Web data layer** — `apps/web/src/lib/api.ts` (fetch client, `credentials: include`) +
typed resource clients in `apps/web/src/lib/db.ts`. No Supabase client remains; signup removed.

Authenticated pages use `ssr: false`. SSR error wrapper: `apps/web/src/server.ts`.

**Routes:** `/auth`, `/dashboard`, `/staff`, `/centres`, `/shifts`, `/availability`, `/users`, `/profile` (+ `/new` and `/:id` detail pages).

## Running locally

```
cp .env.example .env         # fill in secrets
npm install                  # root — installs both workspaces
npm run dev:api              # NestJS on :8000 (needs Postgres + Redis)
npm run dev:web              # web on :3000 (set VITE_API_URL=http://localhost:8000)
# or the full stack:
docker compose up --build    # web + api + postgres + redis behind Traefik
```

Bootstrap admin (empty DB): set `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`; the API
provisions the first admin on startup, then it's invite-only via `POST /api/users` (admin) or the
`/users` admin UI.

**Data cutover (Phase 3):**

```
npm run db:migrate
SOURCE_DATABASE_URL="postgres://..." DATABASE_URL="postgres://..." npm run db:import
```

---

# Features Completed

## July 7, 2026 session (on `main`)

### Earlier in session (commit `de55635`)
- Staff/shift role dropdowns limited to ECA / ECE
- Available staff filtered by matching shift role
- Top/Banned mutual exclusion (UI)
- Availability editor layout overhaul + warm/grey time-range styling

### Ops feedback Phase 1 — frontend
- Centre Shifts tab: cancelled badge matches master list
- Searchable centre dropdown on shift create/edit
- Clear filters on master Shifts list
- Green assigned-staff indicator on shift detail
- Team availability: calendar jump-to-date, From/To date range, clear filters, past badge greying
- Per-staff availability: calendar + optional date range
- Past-due shifts greyed in master list
- Staff documents link optional (any text)
- Centre create → detail on Top & Banned Staff tab

### Ops feedback Phase 2 — database-backed
- **Staffpoint** Yes/No on shifts (create, edit, list column, filter; default No)
- **Primary + secondary** communication channels per centre
- **Multiple centre contacts** with priority ordering (name, title, email, phone)
- **Internal shift comments** (author, timestamp)

All of the above is on **`main`** in commit `54faa3b` ("Update ops platform MVP").

## July 23, 2026 — Stack rewrite (`stack-rewrite` branch)

### Monorepo + backend
- Restructured repo into `apps/web` + `apps/api` npm workspaces.
- New NestJS API (Drizzle + Postgres + Redis): auth (cookie sessions, invite-only), users,
  staff, centres (contacts/channels/top-banned), availability, shifts (assign/status/
  available-staff/contacted/comments), dashboard. Swagger at `/api/docs`.
- Drizzle schema mirrored from Supabase migrations; initial migration
  (`apps/api/drizzle/0000_init.sql`, 11 tables). Shift auto-complete via `@nestjs/schedule`.
- One-shot Supabase → Postgres import script (`npm run db:import`).
- Auth polish: logout cookie clearing matches set-cookie options; weak passwords return 400.

### Web cutover
- Removed Supabase browser client and SSR auth attacher; added typed fetch API client.
- All routes/components use the API via React Query. **Signup removed** (invite-only).
- `documents_url` sanitized to http(s) on write (API) and render (web).

### Security / hygiene / infra
- `.env` untracked + gitignored; added `.env.example`. Redacted infra fingerprints from docs.
- Password policy (min 12, letters+numbers), global auth guard, Traefik + Helmet security headers.
- Root `docker-compose.yml` (web/api/postgres/redis) with Traefik labels + same-origin `/api`.
- Removed stale `bun.lock` / nested web lockfiles (npm workspaces use root lockfile only).

### Lovable UI merged into `stack-rewrite` (from `main`, July 23)
- **Mobile-responsive layout:** collapsible sidebar / top nav on small screens (`AppShell`).
- **Mobile card views** on Shifts list, Users page, and detail pages (centres, staff, shifts).
- **Users admin page** (`/users`): list, invite (admin sets initial password), deactivate/reactivate.
  Wired to NestJS `usersApi` (replaces Supabase server-side invite functions).
- **`no-scrollbar` utility** and overflow/min-width fixes for touch layouts.

**Verified:** `apps/api` `nest build` clean; `apps/web` `tsc --noEmit` clean.

---

# Database / Schema Changes

## Legacy Supabase (`main`)

**Migration file:** `supabase/migrations/20260707130000_ops_feedback_db_features.sql`  
**Base schema:** `supabase/migrations/20260702203952_7de4af9e-c0e7-46be-aee8-691d7d5fbb19.sql`

| Change | Details |
|---|---|
| `shifts.added_to_staffpoint` | `BOOLEAN NOT NULL DEFAULT false` |
| `centres.primary_channel` | Backfilled from `preferred_channel`; legacy column kept in sync |
| `centre_secondary_channels` | Junction table `(centre_id, channel)` for secondary multi-select |
| `centre_contacts` | New table: name, title, email, phone, `sort_order`; legacy flat fields backfilled |
| `shift_comments` | New table: `shift_id`, `author_id` → `profiles`, `body`, `created_at` |

## New stack (`stack-rewrite`)

**Drizzle migration:** `apps/api/drizzle/0000_init.sql` — 11 tables including `users` (replaces
`auth.users` + `profiles`), all domain tables with camelCase API mapping.

**Import:** `apps/api/src/db/import-from-supabase.ts` copies legacy data preserving UUIDs; bcrypt
password hashes copied when available.

---

# New Components and Pages

## July 7 session
| Component | Purpose |
|---|---|
| `SearchableCentreSelect.tsx` | Combobox centre picker for shift forms |
| `ChannelMultiSelect.tsx` | Secondary channel multi-select (excludes primary) |
| `CentreContactsEditor.tsx` | CRUD + reorder centre contacts |
| `ShiftComments.tsx` | List and add internal shift comments |

## July 23 session (stack rewrite + Lovable merge)
| Item | Purpose |
|---|---|
| `apps/web/src/lib/api.ts` | Typed fetch client for NestJS API |
| `apps/web/src/routes/_authenticated/users.tsx` | Admin user management (mobile cards + desktop table) |
| `AppShell.tsx` (updated) | Mobile hamburger nav, `/users` in sidebar |
| `apps/api/src/db/import-from-supabase.ts` | One-shot legacy data import |

---

# Deployment Status

| Environment | URL | Status |
|---|---|---|
| **Lovable / dev (`main`)** | Lovable editor + local dev | Active; syncs from `main` |
| **Stack rewrite (`stack-rewrite`)** | Local / Docker Compose | Built; not yet deployed to staging |
| **Staging (DO)** | `https://ops-test.intra.ca` | Legacy Supabase build deployed earlier; **needs redeploy** with new stack after cutover |
| **Production (ops portal)** | Not yet dedicated | Staging is the current test target |

**Pending for new-stack staging:**
1. Deploy `stack-rewrite` via Docker Compose on droplet
2. Run Drizzle migration + Supabase import on droplet Postgres
3. End-to-end QA (auth, users invite, mobile layout, all domain flows)

**Not in git:** Server-side deploy config and `.env` live on the host only (private ops runbook).

---

# Current Infrastructure

| Service | Details |
|---|---|
| **GitHub** | Private repo; active work on `stack-rewrite` branch |
| **Lovable** | Still connected to `main`; UI changes merged into `stack-rewrite` |
| **Supabase** | Legacy backend on `main` — being replaced by self-hosted Postgres + NestJS |
| **DigitalOcean** | Droplet running Docker + Traefik; hosts staging (details in private ops runbook) |

**Env vars:** see `.env.example` for the full template. Real secrets live only in local `.env` (gitignored) and on the host.

---

# Known Issues (remaining)

| Issue | Severity | Notes |
|---|---|---|
| Stack rewrite not deployed to staging | **High** | Phase 5 QA blocked until droplet deploy + import |
| Supabase → Postgres import not run on staging | **High** | Script ready; needs `SOURCE_DATABASE_URL` + empty migrated DB |
| Shift available staff ignores weekly availability | Medium | Filters role, banned, overlap — not availability windows |
| No DB constraint for Top/Banned mutual exclusion | Low | Enforced in UI + API logic |
| Staff filter on shift list not searchable | Low | Centre picker on shift forms is searchable |
| Legacy free-text roles on old records | Low | Won't match ECA/ECE role filter until updated |
| Users page: no delete / email-invite flow | Low | By design for new stack — admin sets initial password |
| Non-admin users see Users page but cannot invite | Low | List endpoint is admin-only; may 403 for ops role |

---

# Next Priorities (by importance)

1. **Deploy `stack-rewrite`** to droplet staging (`ops-test.intra.ca`)
2. **Run migration + import** — Drizzle migrate, then `npm run db:import` from Supabase
3. **QA staging** — auth, users invite, mobile layout, Staffpoint/contacts/channels/comments
4. **Cut over** — point staging at new stack; decommission Supabase/Lovable after sign-off
5. **P2 polish** — searchable staff filter on shift list; availability-aware shift staff list
6. **Production ops portal hostname** — decide prod URL when staging sign-off complete

---

# Testing Completed

| Area | Result |
|---|---|
| Local production build (`apps/web` + `apps/api`) | ✅ Pass (July 23) |
| Typecheck web + API | ✅ Pass |
| Supabase import script | ✅ Written; not yet run against live data |
| Staging container (legacy stack) | ✅ Pass (July 7) |
| End-to-end staging (new stack) | ⏳ Pending deploy + import |
| Mobile layout QA | ⏳ Pending manual check on device |

---

# Features Completed (all time)

## Authentication & users
- Sign in (signup removed on new stack), flat access, profile page, auth guard, `/` → `/dashboard`
- Admin user management: invite with initial password, deactivate/reactivate (`/users`)

## Staff
- CRUD, ECA/ECE roles, display name, optional documents link, Top/Banned centres (two-way sync + mutual exclusion), availability editor, shift history

## Centres
- CRUD, primary + secondary channels, multiple sortable contacts, Top/Banned staff, create → staff-lists tab, shift history, cancelled badge on Shifts tab

## Availability
- Per-staff weekly editor; team dashboard with day/date/time filters, clear filters, past styling

## Shifts
- CRUD, status workflow, available staff (role/banned/overlap), contacted toggle, assign, Staffpoint field, internal comments, filters, past-due greying, dashboard links, auto-complete cron

## Design
- AppShell sidebar + **mobile hamburger nav**, shadcn/ui, Sonner toasts, responsive card/table layouts

---

# Roadmap (post-MVP)

- Role hierarchy and permissions (beyond admin/ops flag)
- Staff self-service availability portal
- Channel integrations (WhatsApp / GoTo) from Contacted flow
- Reporting / export, audit log, recurring shifts, document upload
- Distance-based staff sorting

---

# Testing Checklist (manual QA)

Use on staging after deploy + import.

**Auth:** sign in/out, profile edit, change password, unauthenticated redirect  
**Users (admin):** invite user, deactivate/reactivate, mobile card layout  
**Staff:** CRUD, ECA/ECE, display name, documents link, Top/Banned, availability editor  
**Centres:** create → staff-lists tab, channels, contacts reorder, Top/Banned, cancelled badge on Shifts tab  
**Shifts:** create/edit, Staffpoint, comments, searchable centre, filters, assign/contacted, past-due grey, mobile cards  
**Availability:** team filters, date range, clear filters, past badges  
**Mobile:** hamburger nav, all list pages usable on phone width  

---

# Recent Changes

### July 23, 2026 (continued) — Lovable merge + gap fixes (`stack-rewrite`)

**Merged from `main` (Lovable):**
- Mobile-responsive `AppShell` (hamburger menu, sticky top bar)
- Mobile card layouts on shifts list and detail pages (centres, staff, shifts)
- New `/users` admin page (ported to NestJS `usersApi` — no Supabase server functions)
- CSS: `no-scrollbar` utility, overflow/min-width touch fixes

**Gap fixes:**
- Supabase → Postgres import script (`npm run db:import`)
- Auth: logout cookie clear options; weak-password → 400
- Removed stale `bun.lock` and nested web lockfile

**Git:** merged `origin/main` into `stack-rewrite`; pushed to GitHub.

### July 23, 2026 — Stack rewrite (initial, `stack-rewrite`)

**Monorepo + backend:** NestJS + Drizzle + Redis API; Drizzle migration; web cutover off Supabase; Docker Compose; secrets hygiene.

### July 7, 2026

**Git (`main`, pushed):** Ops feedback Phase 1 + Phase 2, migration file, staging deploy, this doc's first version.

---

*Last updated: July 23, 2026*
