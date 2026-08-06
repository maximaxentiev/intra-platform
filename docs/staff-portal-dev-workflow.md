# Staff portal — local development workflow

Production and staging must **never** log invite or password-reset tokens. Email delivery is Phase 7.

## Feature flag

Local carer testing requires both:

```env
CARER_PORTAL_ENABLED=true
VITE_CARER_PORTAL_ENABLED=true
```

Restart API and web dev servers after changing env. Production/staging default: **false**.

## Create a test carer account (local only)

Use Drizzle/Postgres directly or a one-off script with env vars (do not commit passwords):

1. Ensure migration `0003` applied: `npm run db:migrate`
2. Insert `staff` + `staff_accounts` with a bcrypt password hash (see ops bootstrap patterns), or use invite flow:

### Invite flow without email

1. Insert `staff_accounts` with `invite_token_hash` = SHA-256 of a token you generate locally, plus `invite_token_expires_at` in the future.
2. Open `http://localhost:8080/carer/invite/<raw-token>` (only when `VITE_CARER_PORTAL_ENABLED=true`).
3. Set password via UI — token is not logged by the API.

Generate hash (Node, local shell only):

```javascript
import { createHash } from "crypto";
const token = "your-dev-only-token";
console.log(createHash("sha256").update(token).digest("hex"));
```

Do **not** paste production tokens or passwords into tickets or logs.

## Verify staff-auth is disabled

With `CARER_PORTAL_ENABLED=false`, `POST /api/staff-auth/login` returns **404**.

## Cookie separation

- Ops session: `SESSION_COOKIE_NAME` (default `intra_session`)
- Carer session: `{SESSION_COOKIE_NAME}_staff`

Sign in to one portal does not authenticate the other.
