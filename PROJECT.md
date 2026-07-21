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

| Layer | Stack |
|---|---|
| Frontend | TanStack Start (React 19 + Vite), TanStack Router, TanStack Query |
| UI | Tailwind CSS 4, shadcn/ui |
| Data | Supabase PostgreSQL + Auth + RLS (client-side CRUD from browser) |
| Build | `@lovable.dev/vite-tanstack-config`, Nitro (`node-server` on VPS) |

Authenticated pages use `ssr: false`. Domain logic lives in `src/lib/db.ts`. SSR error wrapper: `src/server.ts`.

**Routes:** `/auth`, `/dashboard`, `/staff`, `/centres`, `/shifts`, `/availability`, `/profile` (+ `/new` and `/:id` detail pages).

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
- Droplet: `162.243.15.122` (NYC2)
- App path: `/opt/projects/ops-test.intra.ca/app`
- Reverse proxy: Traefik (HTTPS via Let's Encrypt)
- Redeploy script: `/opt/projects/ops-test.intra.ca/redeploy.sh`
- Docker compose project: `ops-test` (use `-p ops-test` to avoid clashing with `usa.intra.ca`)

**Not in git:** Server-side `Dockerfile`, `docker-compose.prod.yml`, and `.env` live on the droplet only. Redeploy source via `git archive` + SCP (repo is private).

**Pending for staging to work end-to-end:**
1. GoDaddy **A record**: `ops-test` → `162.243.15.122`
2. Supabase Auth redirect URLs include `https://ops-test.intra.ca/**`
3. Run ops feedback migration on Supabase

**Note:** Same droplet also hosts `usa.intra.ca` (separate app — `remote-canada-connect`); do not share Docker Compose project names.

---

# Current Infrastructure

| Service | Details |
|---|---|
| **GitHub** | `maximaxentiev/intra-platform` (private), branch `main`, latest `54faa3b` |
| **Lovable** | Connected; pushes to `main` sync to Lovable editor. **Do not force-push** — see `AGENTS.md` |
| **Supabase** | Project `omuzlulbauvcnaaleitb` — DB, Auth, RLS, pg_cron auto-complete |
| **DigitalOcean** | Droplet `162.243.15.122` — Docker + Traefik; staging ops portal at `ops-test.intra.ca` |

**Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (set in Lovable Cloud, local `.env`, and staging `.env` on droplet).

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

### July 7, 2026

**Git (`main`, pushed):**
- `54faa3b` — Ops feedback Phase 1 + Phase 2, `PROJECT.md`, `package-lock.json`, migration file, all related UI
- `de55635` — P0 fixes + availability editor layout/styling

**Database:**
- Added migration `20260707130000_ops_feedback_db_features.sql` (Staffpoint, channels, contacts, shift comments)

**Staging deploy:**
- Deployed `54faa3b` to DigitalOcean at `ops-test.intra.ca` (Traefik + Docker)
- Server config at `/opt/projects/ops-test.intra.ca/`

**Documentation:**
- This `PROJECT.md` update

---

*Last updated: July 7, 2026*
