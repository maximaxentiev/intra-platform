# Fix: build times out and preview never loads (role-choice screen not showing)

## Answer first: the role-choice screen IS implemented

Confirmed on disk and in the generated route tree:

- `apps/web/src/routes/index.tsx` — role-choice screen with "Ops Team" (`/auth`) and "Independent Carer" (`/carer/login`) cards.
- `apps/web/src/routes/carer/login.tsx`, `forgot-password.tsx`, `invite.$token.tsx`, `onboarding.tsx`, `index.tsx`.
- All of the above are registered in `apps/web/src/routeTree.gen.ts`.

So nothing is missing in the app code. The reason you don't see it is the dev server is not running.

## Actual cause (confirmed by reproducing it)

Root `package.json` scripts call themselves recursively. Running `bun run build:dev` at the root prints an endless chain:

```text
$ bun run build:dev --workspace @intra/web
$ bun run build:dev --workspace @intra/web --workspace @intra/web
$ bun run build:dev --workspace @intra/web --workspace @intra/web --workspace @intra/web
... forever
```

This is exactly the `deadline_exceeded` build failure. The dev server has the same problem: nothing is listening on port 8080, so the preview shows a stale page (currently `/auth`).

Root `package.json` has:

```
"dev": "npm run dev --workspace @intra/web"
```

The runner launches this with bun, which resolves `run dev` back to the **root** package's own `dev` script instead of the web workspace's `vite dev`. Each pass appends another `--workspace @intra/web` and spawns a child, producing an unbounded process chain and no build or Vite server.


The runner launches this with bun, which resolves `run dev` back to the **root** package's own `dev` script instead of the web workspace's `vite dev`. Each pass appends another `--workspace @intra/web` and spawns a child, producing a chain of dozens of processes and no Vite server.

## Fix

Rewrite every root `package.json` script that currently uses `npm run X --workspace <pkg>` so it targets the workspace directory directly and cannot re-enter the root script. For example:

```
"dev":       "npm --prefix apps/web run dev --",
"dev:web":   "npm --prefix apps/web run dev --",
"dev:api":   "npm --prefix apps/api run start:dev --",
"build:dev": "npm --prefix apps/web run build:dev --",
"build:web": "npm --prefix apps/web run build --",
"build:api": "npm --prefix apps/api run build --",
```

The `db:*` scripts get the same treatment. `build` (`--workspaces --if-present`) is left as is — it doesn't re-invoke a same-named root script.

## Verification

1. Run `bun run build:dev` at the root and confirm it completes instead of looping.
2. Kill the runaway `bun run dev` process chain and restart the dev server.
3. `curl http://localhost:8080/` and confirm the HTML contains "Welcome to Intra" / "Independent Carer".
4. Screenshot `/` to confirm the two role cards render.


No app/route/UI code changes are needed for this.
