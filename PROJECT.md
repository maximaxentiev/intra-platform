# PROJECT.md

Permanent source of truth for the **Intra Platform** (Ops Portal) — a childcare staffing operations platform.

> **Maintenance rule:** Update this document after every completed development session.

---

# Project Overview

**Version 1 (MVP)** — internal childcare staffing operations portal for the fulfillment team.

- **Users:** Ops team only; flat access (no role hierarchy in V1).
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

**Routes:** `/auth`, `/dashboard`, `/staff`, `/centres`, `/shifts`, `/availability`, `/profile` (+ `/new` and `/:id` detail pages).

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
provisions the first admin on startup, then it's invite-only via `POST /api/users` (admin).

---

# Features Completed (July 7, 2026 session)

## Earlier in session (commit `de55635`)
- Staff/shift role dropdowns limited to ECA / ECE
- Available staff filtered by matching shift role
- Top/Banned mutual exclusion (UI)
- Availability editor layout overhaul + warm/grey time-range styling

## Ops feedback Phase 1 — frontend
- Centre Shifts tab: cancelled badge matches master list
- Searchable centre dropdown on shift create/edit
- Clear filters on master Shifts list
- Green assigned-staff indicator on shift detail
- Team availability: calendar jump-to-date, From/To date range, clear filters, past badge greying
- Per-staff availability: calendar + optional date range
- Past-due shifts greyed in master list
- Staff documents link optional (any text)
- Centre create → detail on Top & Banned Staff tab

## Ops feedback Phase 2 — database-backed (code complete)
- **Staffpoint** Yes/No on shifts (create, edit, list column, filter; default No)
- **Primary + secondary** communication channels per centre
- **Multiple centre contacts** with priority ordering (name, title, email, phone)
- **Internal shift comments** (author, timestamp)

All of the above is on **`main`** in commit `54faa3b` ("Update ops platform MVP").

---

# Database / Schema Changes

**Migration file:** `supabase/migrations/20260707130000_ops_feedback_db_features.sql`  
**Base schema:** `supabase/migrations/20260702203952_7de4af9e-c0e7-46be-aee8-691d7d5fbb19.sql`

| Change | Details |
|---|---|
| `shifts.added_to_staffpoint` | `BOOLEAN NOT NULL DEFAULT false` |
| `centres.primary_channel` | Backfilled from `preferred_channel`; legacy column kept in sync |
| `centre_secondary_channels` | Junction table `(centre_id, channel)` for secondary multi-select |
| `centre_contacts` | New table: name, title, email, phone, `sort_order`; legacy flat fields backfilled |
| `shift_comments` | New table: `shift_id`, `author_id` → `profiles`, `body`, `created_at` |

**Apply on Supabase** (Dashboard SQL editor or `supabase db push`) before DB-dependent features work in any environment.

**Tables unchanged this session:** `profiles`, `staff`, `staff_centre_top`, `staff_centre_banned`, `availability`, `shift_contacted`.

---

# New Components and Pages

## New components (this session)
| Component | Purpose |
|---|---|
| `SearchableCentreSelect.tsx` | Combobox centre picker for shift forms |
| `ChannelMultiSelect.tsx` | Secondary channel multi-select (excludes primary) |
| `CentreContactsEditor.tsx` | CRUD + reorder centre contacts |
| `ShiftComments.tsx` | List and add internal shift comments |

## Updated components / pages
- `CentreForm.tsx` — primary/secondary channels; flat contact fields removed from UI
- `AvailabilityEditor.tsx`, `StaffForm.tsx`
- Routes: `centres.$id`, `centres.new`, `centres.index`, `shifts.new`, `shifts.$id`, `shifts.index`, `availability`
- `src/lib/db.ts` — types, `channelLabel()`, `saveCentreSecondaryChannels()`

No new route URLs were added; existing pages gained the features above.

---

# Deployment Status

| Environment | URL | Status |
|---|---|---|
| **Lovable / dev** | Lovable editor + local `npm run dev` | Active; syncs from `main` |
| **Staging (DO)** | `https://ops-test.intra.ca` | **Deployed** — commit `54faa3b`, container `ops-test-intra-ca` |
| **Production (ops portal)** | Not yet dedicated | Staging is the current test target |

**Staging deploy details:**
- Host: DigitalOcean droplet (IP/paths kept out of git — see the private ops runbook)
- Reverse proxy: Traefik (HTTPS via Let's Encrypt)
- Deployed as an isolated Docker Compose project so other sites on the host are unaffected

**Not in git:** Server-side deploy config and `.env` live on the host only (private ops runbook). Repo is private.

**Pending for staging to work end-to-end:**
1. DNS A record for the staging host → droplet (configured in registrar)
2. Auth callback/allowed origins configured for the staging host
3. Database migrations applied on the target database

---

# Current Infrastructure

| Service | Details |
|---|---|
| **GitHub** | Private repo, active work on `stack-rewrite` branch |
| **Lovable** | Being disconnected as part of the stack rewrite (git + Docker after cutover) |
| **Supabase** | Legacy backend — being replaced by self-hosted Postgres + NestJS (see stack rewrite plan) |
| **DigitalOcean** | Droplet running Docker + Traefik; hosts staging (details in private ops runbook) |

**Env vars:** see `.env.example` for the full template. Real secrets live only in local `.env` (gitignored) and on the host.

---

# Known Issues (remaining)

| Issue | Severity | Notes |
|---|---|---|
| Ops feedback migration not confirmed applied on Supabase | **High** | DB features fail until migration runs |
| Staging DNS / Supabase Auth URLs | **High** | `ops-test.intra.ca` A record + redirect URLs required |
| Shift available staff ignores weekly availability | Medium | Filters role, banned, overlap — not availability windows |
| Supabase generated types stale | Low | `db.ts` casts client; regenerate from schema |
| No DB constraint for Top/Banned mutual exclusion | Low | Enforced in UI only |
| Staff filter on shift list not searchable | Low | Centre picker on shift forms is searchable |
| Signup does not auto-sign-in | Low | Email confirmation may block login if enabled |
| Legacy free-text roles on old records | Low | Won't match ECA/ECE role filter until updated |
| Docker deploy config not in repo | Low | Documented redeploy flow; consider adding `deploy/` to git |

---

# Next Priorities (by importance)

1. **Apply** `20260707130000_ops_feedback_db_features.sql` on Supabase
2. **Finish staging cutover** — GoDaddy A record + Supabase Auth URLs for `ops-test.intra.ca`
3. **QA staging** — full ops feedback checklist (Staffpoint, contacts, channels, comments, auth)
4. **Commit deploy artifacts** to git (`Dockerfile`, compose file) for repeatable staging/prod deploys
5. **Regenerate Supabase TypeScript types** — remove `db.ts` cast workaround
6. **P2 polish** — searchable staff filter on shift list; DB constraint for top/banned; availability-aware shift staff list
7. **Production ops portal hostname** — decide prod URL and deploy path when staging sign-off complete

---

# Testing Completed (July 7, 2026)

| Area | Result |
|---|---|
| Local production build (`npm run build`) | ✅ Pass |
| Ops feedback migration file | ✅ Written; idempotent SQL reviewed |
| Staging container build on DO | ✅ Pass (`ops-test-frontend` image) |
| Traefik routing to staging app | ✅ HTTPS 200 (Host: `ops-test.intra.ca`, server-side) |
| `usa.intra.ca` on same droplet | ✅ Restored after staging deploy (separate compose project) |
| End-to-end staging in browser | ⏳ Pending DNS + Supabase migration + Auth URLs |
| Supabase migration applied | ⏳ Not verified |

---

# Features Completed (all time)

## Authentication & users
- Sign up / sign in, flat access, profile page, auth guard, `/` → `/dashboard`

## Staff
- CRUD, ECA/ECE roles, display name, optional documents link, Top/Banned centres (two-way sync + mutual exclusion), availability editor, shift history

## Centres
- CRUD, primary + secondary channels, multiple sortable contacts, Top/Banned staff, create → staff-lists tab, shift history, cancelled badge on Shifts tab

## Availability
- Per-staff weekly editor; team dashboard with day/date/time filters, clear filters, past styling

## Shifts
- CRUD, status workflow, available staff (role/banned/overlap), contacted toggle, assign, Staffpoint field, internal comments, filters, past-due greying, dashboard links, pg_cron auto-complete

## Design
- AppShell sidebar, shadcn/ui, Sonner toasts

---

# Roadmap (post-MVP)

- Role hierarchy and permissions
- Staff self-service availability portal
- Channel integrations (WhatsApp / GoTo) from Contacted flow
- Reporting / export, audit log, recurring shifts, document upload
- Distance-based staff sorting

---

# Testing Checklist (manual QA)

Use on staging after DNS + migration + Auth URLs are in place.

**Auth:** sign up/in/out, profile edit, unauthenticated redirect  
**Staff:** CRUD, ECA/ECE, display name, documents link, Top/Banned, availability editor  
**Centres:** create → staff-lists tab, channels, contacts reorder, Top/Banned, cancelled badge on Shifts tab  
**Shifts:** create/edit, Staffpoint, comments, searchable centre, filters, assign/contacted, past-due grey  
**Availability:** team filters, date range, clear filters, past badges  

---

# Recent Changes

### July 23, 2026 — Stack rewrite (branch `stack-rewrite`)

**Monorepo + backend:**
- Restructured repo into `apps/web` + `apps/api` npm workspaces.
- New NestJS API (Drizzle + Postgres + Redis): auth (cookie sessions, invite-only), users,
  staff, centres (contacts/channels/top-banned), availability, shifts (assign/status/
  available-staff/contacted/comments), dashboard. Swagger at `/api/docs`.
- Drizzle schema mirrored from the Supabase migrations; initial migration generated
  (`apps/api/drizzle/0000_init.sql`, 11 tables). Shift auto-complete via `@nestjs/schedule`.

**Web cutover:**
- Removed the Supabase browser client and SSR auth attacher; added a typed fetch API client.
- All routes/components now use the API via React Query. **Signup removed** (invite-only).
- `documents_url` sanitized to http(s) on write (API) and render (web).

**Security / hygiene:**
- `.env` untracked + gitignored; added `.env.example`. Redacted infra fingerprints from docs.
- Password policy (min 12, letters+numbers), global auth guard, Traefik + Helmet security headers.

**Infra:**
- Root `docker-compose.yml` (web/api/postgres/redis) with Traefik labels + same-origin `/api`.

**Verified:** `apps/api` `nest build` clean; `apps/web` `tsc --noEmit` clean.

**Still to do:** apply migration to a live DB + import legacy data (Phase 3); QA end-to-end
against the API; decommission Supabase/Lovable after cutover.

### July 7, 2026

**Git (`main`, pushed):**
- `54faa3b` — Ops feedback Phase 1 + Phase 2, `PROJECT.md`, `package-lock.json`, migration file, all related UI
- `de55635` — P0 fixes + availability editor layout/styling

**Database:**
- Added migration `20260707130000_ops_feedback_db_features.sql` (Staffpoint, channels, contacts, shift comments)

**Staging deploy:**
- Deployed ops MVP to the DigitalOcean staging host (Traefik + Docker); deploy details in private ops runbook

**Documentation:**
- This `PROJECT.md` update

---

*Last updated: July 7, 2026*
