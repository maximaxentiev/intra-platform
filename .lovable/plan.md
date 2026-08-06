# Fix: preview never loads (role-choice screen not showing)

## Answer first: the role-choice screen IS implemented

Confirmed on disk and in the generated route tree:

- `apps/web/src/routes/index.tsx` — role-choice screen with "Ops Team" (`/auth`) and "Independent Carer" (`/carer/login`) cards.
- `apps/web/src/routes/carer/login.tsx`, `forgot-password.tsx`, `invite.$token.tsx`, `onboarding.tsx`, `index.tsx`.
- All of the above are registered in `apps/web/src/routeTree.gen.ts`.

So nothing is missing in the app code. The reason you don't see it is the dev server is not running.

## Actual cause

The dev server process is stuck in infinite self-recursion and never binds a port. Nothing is listening on 8080, so the preview shows a stale page (currently `/auth`).

Root `package.json` has:

```
"dev": "npm run dev --workspace @intra/web"
```

The runner launches this with bun, which resolves `run dev` back to the **root** package's own `dev` script instead of the web workspace's `vite dev`. Each pass appends another `--workspace @intra/web` and spawns a child, producing a chain of dozens of processes and no Vite server.

## Fix

One-line change in root `package.json`: make `dev` (and `dev:web`) invoke the web app directly instead of re-entering the root script.

```
"dev":     "npm --prefix apps/web run dev --",
"dev:web": "npm --prefix apps/web run dev --",
```

Same recursion risk applies to `build:dev`, `build:web`, `build:api`, and the `db:*` scripts, which all use `npm run X --workspace ...`. Only `dev` is breaking the preview today; the others should be switched to the `--prefix` form in the same pass so a future build doesn't hit the identical loop.

## Verification

1. Kill the runaway `bun run dev` process chain.
2. Restart the dev server and confirm something is listening on 8080.
3. `curl http://localhost:8080/` and confirm the HTML contains "Welcome to Intra" / "Independent Carer".
4. Screenshot `/` to confirm the two role cards render.

No app/route/UI code changes are needed for this.
