
## Users Admin UI

Any signed-in ops user can manage other ops users. Invites use Supabase's `inviteUserByEmail` (email link → user sets password on landing).

### New route
`/_authenticated/users` — added to sidebar as "Users"

Table columns: Name, Email, Status (Active / Invited / Deactivated), Last sign-in, Created. Row actions:
- **Invite** button (top right) → dialog with email + optional full name → calls invite server fn → row appears as "Invited" until user accepts.
- **Resend invite** (for Invited rows).
- **Deactivate / Reactivate** (ban_duration toggle via admin API).
- **Delete** (destructive confirm dialog) → removes auth user + cascades profile.

### Server functions (`src/lib/users.functions.ts`)
All use `requireSupabaseAuth` middleware (any signed-in user), then dynamically import `supabaseAdmin` for the privileged calls:

- `listOpsUsers()` — `supabaseAdmin.auth.admin.listUsers()`, joins `profiles` for full_name, returns flat rows.
- `inviteOpsUser({ email, full_name })` — `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: <origin>/auth })`.
- `resendInvite({ user_id })` — re-invites by email.
- `setUserActive({ user_id, active })` — `updateUserById` with `ban_duration: active ? 'none' : '876000h'`.
- `deleteOpsUser({ user_id })` — `deleteUser`; profile row removed by existing FK cascade (verify; add cascade in migration if missing).

Handlers return plain DTOs only. Errors mapped to friendly messages via toast.

### Profile sync
Existing `handle_new_user` trigger already creates `profiles` row on signup — invites flow through the same trigger when the user accepts, so name from invite metadata is picked up. Migration only needed if `profiles.id` FK to `auth.users` lacks `ON DELETE CASCADE` — will verify and add if missing.

### UI details
- Uses existing `PageHeader`, shadcn `Table`, `Dialog`, `AlertDialog`, `StatusBadge` for status pill.
- Toast confirmations on every action.
- Empty state when only current user exists.
- No role/permission gating in V1 (matches current model); a small inline note explains "Every ops user has full access."

### Out of scope
- Roles/permissions (V1 stays flat).
- Editing another user's email/name (users edit their own via `/profile`).
- Bulk actions.

Approve and I'll build it.
