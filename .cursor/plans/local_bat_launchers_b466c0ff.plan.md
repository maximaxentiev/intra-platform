---
name: Local bat launchers
overview: First merge stack-rewrite into main (not merged today). Then add self-contained Windows bat launchers under Intra repo dev/ so anyone who clones main can run the app locally with one script.
todos:
  - id: merge-main
    content: "Merge origin/stack-rewrite into main (FF or PR); ensure .env stays untracked; push main; confirm monorepo is default"
    status: pending
  - id: compose-dev
    content: Add docker-compose.dev.yml (Postgres 5434 + Redis 6380) and document local .env URLs in .env.example
    status: pending
  - id: bats
    content: "Add dev/*.bat + HOWTO-local.txt; runservers prints PowerShell/cd/run/browser/restart instructions at end"
    status: pending
  - id: env-wiring
    content: Ensure local API/migrate load root .env (ConfigModule/dotenv or bat-exported vars)
    status: pending
  - id: smoke
    content: "Smoke on main: runservers installs, migrates, opens API+Web, prints HOWTO; killservers tears down"
    status: pending
isProject: false
---

# Local bat launchers for Intra

## Goal

Ship **in-repo** Windows scripts so a teammate who clones Intra can run the app locally without deploying. One command starts dependencies, installs packages on first run, applies DB migrations, and opens the API and web app. Paths are relative (`%~dp0`) — no machine-specific hardcoded folders.

This plan is **standalone** and lives with the Intra git repo.

**Prerequisite:** `main` must be the Nest/Drizzle monorepo first. Today it is **not** — `origin/stack-rewrite` is ahead of `origin/main` and has not been merged. Bat work runs **only after** that merge.

## Phase 0 — Merge `stack-rewrite` → `main` (do this first)

### Current status (verified)

- `origin/main` tip: legacy Supabase layout (`7df4c31` and related)
- `origin/stack-rewrite` tip: monorepo rewrite (`4568ef2` and prior) — **contains** all of `main` history (`main` is an ancestor of `stack-rewrite`)
- Count: **0** commits only on main, **4+** commits only on stack-rewrite → safe to **fast-forward** `main` to `stack-rewrite`

### Merge steps

1. `git fetch origin`
2. Checkout `main`, ensure clean working tree
3. Fast-forward: `git merge --ff-only origin/stack-rewrite`
   - If FF fails (unexpected divergence), open a PR `stack-rewrite` → `main` and merge via GitHub instead
4. Verify post-merge:
   - Repo root has `apps/web`, `apps/api`, `docker-compose.yml`
   - `.env` is **not** tracked (`git ls-files .env` empty); `.env.example` exists
   - `src/integrations/supabase` is gone from tree
5. `git push origin main`
6. Confirm default branch tip is the monorepo; teammates pull `main`

### Known consequences (accepted by stack-rewrite plan)

- Lovable sync on `main` will no longer match a simple Vite/Supabase app — treat Lovable as disconnected after this merge
- Staging still needs droplet cutover separately; merge does **not** equal production deploy

### Do not start bat files until Phase 0 is done

Bat scripts assume `apps/web`, `apps/api`, `npm run dev:api` / `dev:web`, and Drizzle migrate scripts at repo root.

---

## Phase 1 — Local bat launchers (on `main` after merge)

### Layout (all committed to git)

```text
dev/
  runservers.bat      # one-shot: kill → deps → db up → migrate → API + Web → print HOWTO
  killdev.bat         # stop API/Web processes + free ports (keep Postgres/Redis)
  killservers.bat     # killdev + docker compose down
  runback.bat         # Nest API (dev watch)
  runfront.bat        # Vite / TanStack web (dev)
  postgres-dev-up.bat # start local Postgres + Redis containers
  HOWTO-local.txt     # same end-user instructions as printed by runservers.bat
docker-compose.dev.yml  # Postgres + Redis only, ports published to localhost
.env.example            # local localhost URLs documented
```

### Local infra ([docker-compose.dev.yml](docker-compose.dev.yml))

Production [docker-compose.yml](docker-compose.yml) is Traefik-oriented and does **not** publish DB ports for a host-run Node process. Add a **dev-only** compose:

| Service | Image | Host port | Notes |
|---------|--------|-----------|--------|
| `postgres` | `postgres:16-alpine` | **5434** | Dedicated Intra local port |
| `redis` | `redis:7-alpine` | **6380** | Dedicated Intra local port |

- Compose project name: `intra-dev`
- Credentials aligned with [`.env.example`](.env.example)
- Healthchecks so migrate waits until Postgres is ready

Local `.env` (created from `.env.example` on first run if missing):

```env
DATABASE_URL=postgres://intra:...@127.0.0.1:5434/intra
REDIS_URL=redis://127.0.0.1:6380
API_PORT=8000
VITE_API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080
SESSION_COOKIE_SECURE=false
BOOTSTRAP_ADMIN_EMAIL=...
BOOTSTRAP_ADMIN_PASSWORD=...
```

Kill script frees ports **8000, 3000, 8080, 5173**.

### Bat behavior

#### `runservers.bat`

1. `cd /d "%~dp0.."` (repo root)
2. Call `killdev.bat`
3. If `.env` missing → copy `.env.example` → `.env`
4. `postgres-dev-up.bat` (clear error if Docker Desktop is not running)
5. Require Node/npm; if root `node_modules` missing → `npm install --no-audit`
6. Wait for Postgres healthy → `npm run db:migrate`
7. Open `intra - API` / `intra - Web` windows
8. Print end-user HOWTO, then `pause`

#### End-user HOWTO (printed + [`dev/HOWTO-local.txt`](dev/HOWTO-local.txt))

```text
========================================
 HOW TO RUN INTRA LOCALLY (next time)
========================================

1. Press the Windows key, type: PowerShell
2. Open Windows PowerShell
3. Type this and press Enter:
     cd /d "<exact path printed here>\dev"

4. Type this and press Enter:
     .\runservers.bat

5. Wait until you see "Done. API + Web launched."
   Two windows open (intra - API and intra - Web). Leave them open.

6. Open your browser and go to:
     http://localhost:8080
   (If that fails, check the "intra - Web" window for the Local URL Vite printed.
    API docs: http://localhost:8000/api/docs)

7. Sign in with the bootstrap admin email/password from the .env file
   in the Intra project folder.

Alternate: in File Explorer, open the Intra\dev folder and double-click runservers.bat

----------------------------------------
 STOP / RESTART
----------------------------------------
- To stop: close the "intra - API" and "intra - Web" windows.
- To restart: run .\runservers.bat again (it kills old processes first).
- To also stop Postgres/Redis: run .\killservers.bat

========================================
```

#### `killdev.bat` / `killservers.bat` / `runback.bat` / `runfront.bat`

- Kill by window title + ports + repo-path node processes
- `killservers.bat` also `docker compose ... down`
- API/web use `npm run dev:api` / `dev:web`; ensure root `.env` is loaded for migrate + Nest

### Prerequisites (printed near top of runservers.bat)

```text
Before first run: Docker Desktop running, Node 22+ on PATH.
```

## Out of scope

- Droplet staging cutover / Supabase decommission (separate stack-rewrite Phase 5)
- Supabase `db:import` on every local start
- Changing production Traefik `docker-compose.yml` behavior beyond what already exists on the branch

## Success criteria

- `main` is fast-forwarded (or PR-merged) to include the monorepo; `.env` not tracked
- Anyone who clones **`main`** can run **`dev\runservers.bat`** and get API + Web on local Postgres/Redis with migrations applied
- Re-running kills prior processes and relaunches cleanly
- No hardcoded personal machine paths in scripts
- Launch finish screen explains PowerShell → `cd` → `.\runservers.bat` → browser → stop/restart
