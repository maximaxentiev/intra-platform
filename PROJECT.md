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

> **Stack rewrite complete on `main`.** Production URL **`https://platform.intra.ca`**
> (formerly `ops-test.intra.ca`, which 301-redirects during cutover) runs the self-hosted
> NestJS + Drizzle + Postgres + Redis stack via Docker Compose. Supabase/Lovable are no longer
> used at runtime on staging; decommission those services after legacy data import.

**Monorepo layout**

| Path | Contents |
|---|---|
| `apps/web` | TanStack Start (React 19 + Vite), TanStack Router/Query, Tailwind 4, shadcn/ui |
| `apps/api` | NestJS 11 (Express) + Drizzle ORM + node-postgres + ioredis, Swagger at `/api/docs` |
| `docker-compose.yml` | web + api + postgres + redis behind Traefik (same-origin `/api` routing) |
| `docker-compose.dev.yml` | local-dev-only Postgres (`:5434`) + Redis (`:6380`), no Traefik |
| `dev/` | Windows `.bat` launchers for local dev (`runservers`, `killservers`, etc.) |
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

**Windows — one-click launchers (recommended):**

```
dev\runservers.bat     # kills stale servers, starts Postgres/Redis (Docker), runs
                        # migrations, launches API + Web in their own windows
dev\killservers.bat    # stops the dev servers AND the Postgres/Redis containers
dev\killdev.bat        # stops just the API/Web dev server processes
dev\runback.bat        # API only
dev\runfront.bat       # Web only
```

Requires Node 22+ and Docker Desktop running. `dev\runservers.bat` auto-creates `.env`
from `.env.example` on first run (local-dev defaults — Postgres on `127.0.0.1:5434`, Redis
on `127.0.0.1:6380`, no collision with any other local Postgres/Redis). Open
**http://localhost:8080** (web) once both windows report ready; API + Swagger docs at
`http://localhost:8000/api/docs`. See `dev\HOWTO-local.txt` for the plain-language walkthrough.
This is dev-infra only (`docker-compose.dev.yml`, Postgres + Redis) — it does not build or run
the web/api containers, unlike the root `docker-compose.yml` used for staging/production.

**Manual / macOS / Linux:**

```
cp .env.example .env         # fill in secrets
npm install                  # root — installs both workspaces
docker compose -f docker-compose.dev.yml up -d   # local Postgres (5434) + Redis (6380)
npm run db:migrate
npm run dev:api               # NestJS on :8000
npm run dev:web                # web on :8080 (set VITE_API_URL=http://localhost:8000)
# or the full staging-like stack:
docker compose up --build    # web + api + postgres + redis behind Traefik
```

Bootstrap admin (empty DB): set `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD`; the API
provisions the first admin on startup, then it's invite-only via `POST /api/users` (admin) or the
`/users` admin UI.

**Data cutover (Phase 3):**

```
npm run db:migrate
# Option A — direct Postgres (Supabase dashboard connection string):
SOURCE_DATABASE_URL="postgres://..." DATABASE_URL="postgres://..." npm run db:import
# Option B — Supabase REST + auth admin (service role key on server only):
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... npm run db:import:api
```

**Staging/production deploy:** copy repo to droplet, set `APP_HOST=platform.intra.ca`,
`LEGACY_APP_HOST=ops-test.intra.ca`, and secrets in `.env`, run `scripts/deploy-staging.sh`.
Traefik router names are prefixed `intra-platform-*` (Compose project remains `intra-ops-test`
for the same Postgres/Redis volumes).

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

## July 23, 2026 — Stack rewrite + staging cutover (merged to `main`)

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

### Staging deploy (July 23)
- Deployed full Compose stack to droplet at `https://ops-test.intra.ca` (web + api + postgres + redis).
- Legacy Supabase frontend container removed; Traefik routes to new stack.
- Bootstrap admin provisioned on empty DB (credentials on droplet only — see private ops runbook).
- **Legacy data import pending** — add `SOURCE_DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to
  droplet `.env`, then re-run `scripts/deploy-staging.sh` import step.

**Verified on staging:** `/api/health` 200, auth login + session cookie, dashboard loads, Users nav,
401 on unauthenticated API, security headers (HSTS, nosniff, frame-deny, referrer-policy).

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

## New stack (`main`, July 23)

**Drizzle migration:** `apps/api/drizzle/0000_init.sql` — 11 tables including `users` (replaces
`auth.users` + `profiles`), all domain tables with camelCase API mapping.

**Import:** `apps/api/src/db/import-from-supabase.ts` (direct Postgres) and
`import-from-supabase-api.ts` (Supabase REST + Auth Admin) copy legacy data preserving UUIDs;
bcrypt password hashes copied when available.

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

## July 23 session (local Windows dev launchers)
| Item | Purpose |
|---|---|
| `dev/runservers.bat` | One-click local dev: kills stale servers, starts Postgres/Redis, runs migrations, launches API + Web windows |
| `dev/killservers.bat`, `dev/killdev.bat` | Stop dev servers (+ optionally the DB containers) |
| `dev/runback.bat`, `dev/runfront.bat` | Launch just the API or just the Web dev server |
| `dev/postgres-dev-up.bat` | Start/wait-healthy local Postgres + Redis containers |
| `dev/HOWTO-local.txt` | Plain-language local run instructions, printed at the end of `runservers.bat` |
| `docker-compose.dev.yml` | Local-only Postgres (`:5434`) + Redis (`:6380`), separate from staging's `docker-compose.yml` |
| `apps/api/src/config/root-env.ts` | Finds the monorepo root `.env` regardless of the workspace-scoped cwd `npm run dev:api`/`db:migrate` run with |
| `apps/api/src/db/import-from-supabase.ts` | One-shot legacy data import (direct Postgres) |
| `apps/api/src/db/import-from-supabase-api.ts` | One-shot legacy data import (Supabase REST) |
| `scripts/deploy-staging.sh` | Droplet deploy script (Compose build, health wait, optional import) |

---

# Deployment Status

| Environment | URL | Status |
|---|---|---|
| **Production (DO)** | `https://platform.intra.ca` | **Target** — same stack (`intra-ops-test`); `ops-test.intra.ca` → 301 redirect |
| **Local dev** | `dev\runservers.bat` (Windows) or `npm run dev:web` + `npm run dev:api` | Active |
| **Lovable** | Editor | **Disconnect when ready** — `main` no longer uses Supabase client |
| **Supabase (legacy)** | Hosted Postgres + Auth | **Decommission after import** — runtime no longer depends on it |
| **Production (ops portal)** | Not yet dedicated | Staging is the current test target |

**Staging deploy path on droplet:** `/opt/projects/intra-platform/` (private ops runbook).

**Post-deploy import (one-time):** set `SOURCE_DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` in
droplet `.env`, then:

```
docker compose -p intra-ops-test exec -T api node dist/db/import-from-supabase-api.js
```

**Not in git:** `.env`, bootstrap credentials, Supabase service role.

---

# Current Infrastructure

| Service | Details |
|---|---|
| **GitHub** | Private repo; `main` = NestJS monorepo stack |
| **Lovable** | Can be disconnected — web no longer uses Supabase client |
| **Supabase** | Legacy data source only until import completes; then pause/delete project |
| **DigitalOcean** | Droplet: Traefik + Compose (`intra-ops-test` + other sites) |
| **Local dev** | Docker Desktop (Postgres/Redis via `docker-compose.dev.yml`); Node 22+ |

**Env vars:** see `.env.example` for the full template. Real secrets live only in local `.env` (gitignored) and on the host.

---

# Known Issues (remaining)

| Issue | Severity | Notes |
|---|---|---|
| Legacy Supabase data not imported to staging Postgres | **High** | Empty DB except bootstrap admin; needs `SOURCE_DATABASE_URL` or service role |
| Shift available staff ignores weekly availability | Medium | Filters role, banned, overlap — not availability windows |
| No DB constraint for Top/Banned mutual exclusion | Low | Enforced in UI + API logic |
| Staff filter on shift list not searchable | Low | Centre picker on shift forms is searchable |
| Legacy free-text roles on old records | Low | Won't match ECA/ECE role filter until updated |
| Web CSP not strict (Helmet CSP disabled for API) | Low | Accepted residual — API is JSON-only; Traefik adds frame/HSTS headers |
| Historical `.env` was once tracked | Low | Removed from git; rotate any secrets that were in the old file |

---

# Security Closeout (audit C1–L3)

| ID | Status | Resolution |
|---|---|---|
| **C1** Open signup + full-table access | **Closed** | Invite-only Nest auth; signup UI removed; guards on all data routes |
| **H1** Browser → Supabase direct | **Closed** | Supabase client deleted; web calls Nest API only |
| **H2** Secrets in git | **Closed** | `.env` gitignored/untracked; `.env.example` only; infra fingerprints redacted |
| **M1** Comment author spoofing | **Closed** | `authorId` set server-side from session |
| **M2** Unsafe document URLs | **Closed** | http(s) validation on API write + web render |
| **M3** Missing auth on routes | **Closed** | Global `SessionGuard` + `@Public()` opt-out |
| **L1** Weak password policy | **Closed** | Min 12 chars, letters + numbers; 400 on violation |
| **L2** Service-role footgun in web | **Closed** | Supabase integrations removed from web |
| **L3** Missing security headers | **Closed** | Traefik middleware + Helmet on API |

**Accepted residuals:** API Helmet CSP disabled (JSON API); web app sets its own CSP in future if
needed. Historical `.env` in git history — rotate credentials if concerned.

---

# Next Priorities (by importance)

1. **Import legacy Supabase data** — add service role or `SOURCE_DATABASE_URL` to droplet `.env`, run import
2. **Full QA on staging** — staff/centres/shifts flows with real data; mobile layout on device
3. **Decommission Supabase + disconnect Lovable** after import sign-off
4. **Production hostname** — decide prod URL and deploy path when staging sign-off complete
5. **P2 polish** — searchable staff filter; availability-aware shift staff list

---

# Testing Completed

| Area | Result |
|---|---|
| Local production build (`apps/web` + `apps/api`) | ✅ Pass (July 23) |
| Typecheck web + API | ✅ Pass |
| Local dev launchers (`.bat` scripts, env loading) | ✅ Pass (July 23) |
| Supabase import scripts | ✅ Written; not yet run against live data |
| Staging container (legacy Supabase stack) | ✅ Pass (July 7) |
| End-to-end staging (NestJS stack) | ✅ Auth, dashboard, API routing, security headers (July 23) |
| Local end-to-end (Docker Desktop + `runservers.bat`) | ⏳ Requires Docker Desktop running on dev machine |
| Legacy data import on staging | ⏳ Pending Supabase credentials on droplet |
| Mobile layout QA | ⏳ Pending manual device check |

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

## Local development (July 23)
- Windows one-click launchers (`dev/runservers.bat`) — Postgres/Redis via Docker, auto-migrate, API + Web in separate windows
- Local-only Compose file (`docker-compose.dev.yml`) on ports 5434/6380
- Root `.env` loading fix for workspace-scoped npm scripts

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

> **Summary (July 7 → July 23, 2026):** Ops feedback features shipped on Supabase/Lovable stack
> (July 7). Full stack rewrite to NestJS + Drizzle monorepo, web cutover off Supabase, Lovable
> mobile UI merge, staging deploy to `ops-test.intra.ca`, security audit closeout, and Windows
> local dev launchers (July 23). Legacy Supabase data import to staging Postgres remains pending.

### July 23, 2026 — Local Windows dev launchers

- Added `dev/` folder: `runservers.bat`, `killservers.bat`, `killdev.bat`, `runback.bat`,
  `runfront.bat`, `postgres-dev-up.bat`, `HOWTO-local.txt`
- Added `docker-compose.dev.yml` — local Postgres (`127.0.0.1:5434`) + Redis (`127.0.0.1:6380`)
- Fixed root `.env` loading via `apps/api/src/config/root-env.ts` (API, migrate, drizzle-kit)
- Updated `.env.example` with local-dev-ready defaults and staging/prod override notes

### July 23, 2026 — Staging cutover + merge to `main`

- Deployed full Compose stack to `ops-test.intra.ca`; removed legacy Supabase frontend container
- Fixed Traefik router name collision with `usa.intra.ca` (`intra-ops-test-*` prefix)
- Merged `stack-rewrite` → `main`; `.env` remains gitignored
- Security closeout: C1–L3 documented above

### July 23, 2026 — Lovable merge + gap fixes

- Mobile-responsive `AppShell`, mobile card layouts, `/users` admin page (NestJS `usersApi`)
- Supabase → Postgres import scripts; auth logout cookie fix; weak-password → 400
- Removed stale `bun.lock` and nested web lockfile

### July 23, 2026 — Stack rewrite (initial)

- Monorepo (`apps/web` + `apps/api`); NestJS + Drizzle + Redis API; web cutover off Supabase
- Docker Compose for staging; secrets hygiene; Drizzle initial migration

### July 7, 2026 — Ops feedback + Supabase migration

- Phase 1 (UI): searchable centre picker, filters, availability calendar/range, past-due greying,
  cancelled badge on centre Shifts tab, green assigned indicator, documents link optional
- Phase 2 (DB): Staffpoint field, primary/secondary channels, centre contacts, shift comments
- Supabase migration `20260707130000_ops_feedback_db_features.sql`
- Staging deploy of Supabase/Lovable frontend to `ops-test.intra.ca` (since replaced)

---

*Last updated: July 23, 2026*
