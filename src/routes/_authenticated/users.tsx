import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Mail, UserPlus, Ban, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  listOpsUsers, inviteOpsUser, resendInvite, setUserActive, deleteOpsUser,
  type OpsUserRow,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "Users · Ops Portal" },
      { name: "description", content: "Manage ops team members: invite, deactivate, or remove users." },
      { property: "og:title", content: "Users · Ops Portal" },
      { property: "og:description", content: "Manage ops team members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Status = "active" | "invited" | "deactivated";

function statusOf(u: OpsUserRow): Status {
  if (u.banned_until && new Date(u.banned_until) > new Date()) return "deactivated";
  if (!u.email_confirmed_at && !u.last_sign_in_at) return "invited";
  return "active";
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function UsersPage() {
  const qc = useQueryClient();
  const list = useServerFn(listOpsUsers);
  const invite = useServerFn(inviteOpsUser);
  const resend = useServerFn(resendInvite);
  const setActive = useServerFn(setUserActive);
  const del = useServerFn(deleteOpsUser);

  const { data: users, isLoading } = useQuery({
    queryKey: ["ops-users"],
    queryFn: () => list(),
  });

  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<OpsUserRow | null>(null);

  const inviteMut = useMutation({
    mutationFn: (v: { email: string; full_name: string }) =>
      invite({ data: { email: v.email.trim(), full_name: v.full_name.trim(), redirect_origin: window.location.origin } }),
    onSuccess: () => {
      toast.success("Invitation sent");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send invite"),
  });

  const resendMut = useMutation({
    mutationFn: (u: OpsUserRow) =>
      resend({ data: { user_id: u.id, email: u.email, redirect_origin: window.location.origin } }),
    onSuccess: () => toast.success("Invitation re-sent"),
    onError: (e: any) => toast.error(e?.message ?? "Failed to resend invite"),
  });

  const activeMut = useMutation({
    mutationFn: (v: { user_id: string; active: boolean }) => setActive({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "User reactivated" : "User deactivated");
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { user_id: id } }),
    onSuccess: () => {
      toast.success("User deleted");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["ops-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Team"
        title="Users"
        subtitle="Every ops user has full access to the platform. Invite teammates by email; they'll set their own password."
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Invite user
          </Button>
        }
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-[60px]"></TableHead>
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
              const s = statusOf(u);
              const isMe = u.id === meId;
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.full_name || <span className="text-muted-foreground">—</span>}
                    {isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={s}>
                      {s === "invited" ? "Invited" : s === "deactivated" ? "Deactivated" : "Active"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmt(u.last_sign_in_at)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmt(u.created_at)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {s === "invited" && (
                          <DropdownMenuItem onClick={() => resendMut.mutate(u)}>
                            <Mail className="h-4 w-4 mr-2" /> Resend invite
                          </DropdownMenuItem>
                        )}
                        {s !== "deactivated" && !isMe && (
                          <DropdownMenuItem onClick={() => activeMut.mutate({ user_id: u.id, active: false })}>
                            <Ban className="h-4 w-4 mr-2" /> Deactivate
                          </DropdownMenuItem>
                        )}
                        {s === "deactivated" && (
                          <DropdownMenuItem onClick={() => activeMut.mutate({ user_id: u.id, active: true })}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Reactivate
                          </DropdownMenuItem>
                        )}
                        {!isMe && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmDelete(u)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
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
              They'll get an email with a link to set their password and join the ops portal.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMut.mutate({ email: inviteEmail, full_name: inviteName });
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
              <Label htmlFor="inv-name">Full name (optional)</Label>
              <Input
                id="inv-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMut.isPending}>
                {inviteMut.isPending ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.email} will permanently lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
