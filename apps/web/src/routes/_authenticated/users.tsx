import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, UserPlus, Ban, CheckCircle2, Loader2, KeyRound, Copy } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authApi, usersApi, type AdminPasswordResetResult, type CurrentUser, type UserRole } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "Users · Intra Platform" },
      { name: "description", content: "Manage ops team members: invite, deactivate, or reactivate users." },
      { property: "og:title", content: "Users · Intra Platform" },
      { property: "og:description", content: "Manage ops team members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function UsersPage() {
  const qc = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["ops-users"],
    queryFn: () => usersApi.list(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => authApi.me(),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("ops");
  const [invitePassword, setInvitePassword] = useState("");

  const [resetTarget, setResetTarget] = useState<CurrentUser | null>(null);
  const [resetResult, setResetResult] = useState<AdminPasswordResetResult | null>(null);

  const inviteMut = useMutation({
    mutationFn: () =>
      usersApi.invite({
        email: inviteEmail.trim(),
        fullName: inviteName.trim(),
        role: inviteRole,
        password: invitePassword,
      }),
    onSuccess: () => {
      toast.success("User created — share the initial password securely");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("ops");
      setInvitePassword("");
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed to create user"),
  });

  const activeMut = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) =>
      usersApi.update(v.userId, { isActive: v.active }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "User reactivated" : "User deactivated");
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Update failed"),
  });

  const resetMut = useMutation({
    mutationFn: (userId: string) => usersApi.resetPassword(userId),
    onSuccess: (result) => {
      setResetResult(result);
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Password reset failed"),
  });

  function closeResetDialogs() {
    setResetTarget(null);
    setResetResult(null);
  }

  async function copyTemporaryPassword() {
    if (!resetResult?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(resetResult.temporaryPassword);
      toast.success("Password copied");
    } catch {
      toast.error("Unable to copy password");
    }
  }

  function rowActions(u: CurrentUser, isMe: boolean) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setResetTarget(u)}>
            <KeyRound className="h-4 w-4 mr-2" /> Reset password
          </DropdownMenuItem>
          {u.isActive && !isMe && (
            <DropdownMenuItem onClick={() => activeMut.mutate({ userId: u.id, active: false })}>
              <Ban className="h-4 w-4 mr-2" /> Deactivate
            </DropdownMenuItem>
          )}
          {!u.isActive && (
            <DropdownMenuItem onClick={() => activeMut.mutate({ userId: u.id, active: true })}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Users"
        subtitle="Every ops user has full access. Admins create accounts with an initial password (invite-only — no public signup)."
        actions={
          me?.role === "admin" ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Invite user
            </Button>
          ) : undefined
        }
      />

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {isLoading && (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading users…
          </div>
        )}
        {!isLoading && (users ?? []).length === 0 && (
          <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">
            No users yet.
          </div>
        )}
        {!isLoading && (users ?? []).map((u) => {
          const isMe = u.id === me?.id;
          return (
            <div key={u.id} className="rounded-lg border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {u.fullName || <span className="text-muted-foreground">—</span>}
                    {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusBadge status={u.isActive ? "active" : "deactivated"}>
                    {u.isActive ? "Active" : "Deactivated"}
                  </StatusBadge>
                  {me?.role === "admin" && rowActions(u, isMe)}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>Role: {u.role}</span>
                <span>Added: {fmt(u.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Added</TableHead>
              {me?.role === "admin" && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading users…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (users ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No users yet.
                </TableCell>
              </TableRow>
            )}
            {(users ?? []).map((u) => {
              const isMe = u.id === me?.id;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.fullName || <span className="text-muted-foreground">—</span>}
                    {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="capitalize">{u.role}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.isActive ? "active" : "deactivated"}>
                      {u.isActive ? "Active" : "Deactivated"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmt(u.createdAt)}</TableCell>
                  {me?.role === "admin" && <TableCell>{rowActions(u, isMe)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              Create their account with an initial password. Share it securely — they'll change it from their profile.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMut.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="inv-email">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-name">Full name *</Label>
              <Input
                id="inv-name"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger id="inv-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ops">Ops</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-password">Initial password * (min 12, letters + numbers)</Label>
              <Input
                id="inv-password"
                type="password"
                required
                minLength={12}
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMut.isPending}>
                {inviteMut.isPending ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetTarget !== null && resetResult === null}
        onOpenChange={(open) => {
          if (!open) closeResetDialogs();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password?</DialogTitle>
            <DialogDescription>
              This will replace the user&apos;s current password, sign them out of existing sessions,
              and create a temporary password. They will be required to choose a new password the
              next time they sign in.
            </DialogDescription>
          </DialogHeader>
          {resetTarget ? (
            <p className="text-sm text-foreground">
              <span className="font-medium">{resetTarget.fullName || resetTarget.email}</span>
              <span className="block text-muted-foreground">{resetTarget.email}</span>
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeResetDialogs}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={resetMut.isPending || !resetTarget}
              onClick={() => resetTarget && resetMut.mutate(resetTarget.id)}
            >
              {resetMut.isPending ? "Resetting…" : "Reset password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resetResult !== null}
        onOpenChange={(open) => {
          if (!open) closeResetDialogs();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Send this temporary password securely to the user. They will be required to choose a
              new password when they next sign in.
            </DialogDescription>
          </DialogHeader>
          {resetResult ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <p className="font-mono text-sm font-semibold tracking-wide break-all">
                  {resetResult.temporaryPassword}
                </p>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={() => void copyTemporaryPassword()}>
                <Copy className="mr-2 h-4 w-4" /> Copy password
              </Button>
              <p className="text-xs text-muted-foreground">
                This temporary password will only be shown once and expires in 24 hours.
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" onClick={closeResetDialogs}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
