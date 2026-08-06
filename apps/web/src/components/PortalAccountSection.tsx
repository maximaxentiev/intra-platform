import { type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffApi, type PortalAccountInfo, type PortalInvitationResult } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  PORTAL_ACCOUNT_STATUS_LABELS,
  portalStatusBadgeVariant,
  type PortalAccountDisplayStatus,
} from "@/lib/portal-account-status";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function PortalAccountSection({
  staffId,
  portalAccount,
}: {
  staffId: string;
  portalAccount: PortalAccountInfo | null;
}) {
  const qc = useQueryClient();
  const status: PortalAccountDisplayStatus = portalAccount?.accountStatus ?? "no_account";

  const inviteMut = useMutation({
    mutationFn: (resend: boolean) => staffApi.sendPortalInvitation(staffId, { resend }),
    onSuccess: (result: PortalInvitationResult) => {
      void qc.invalidateQueries({ queryKey: ["staff", staffId] });
      void qc.invalidateQueries({ queryKey: ["staff-list"] });
      if (result.emailSent) {
        toast.success(result.resend ? "Invitation resent" : "Portal invitation sent");
      } else {
        toast.error(result.message ?? "Invitation created but email delivery failed.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disableMut = useMutation({
    mutationFn: () => staffApi.disablePortalAccess(staffId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", staffId] });
      void qc.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Portal access disabled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const enableMut = useMutation({
    mutationFn: () => staffApi.enablePortalAccess(staffId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff", staffId] });
      void qc.invalidateQueries({ queryKey: ["staff-list"] });
      toast.success("Portal access re-enabled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canInvite = status === "no_account" || status === "invited" || status === "incomplete" || status === "active";
  const canResend = status !== "no_account" && status !== "disabled";

  return (
    <Card className="border-border/70 shadow-xs overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          Portal account
          <PortalStatusBadge status={status} />
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {status === "no_account"
            ? "No carer portal account yet. Send an invitation so they can complete onboarding."
            : status === "invited"
              ? "Invitation sent — waiting for them to set a password."
              : status === "incomplete"
                ? "Signed in, but onboarding is not finished yet."
                : status === "disabled"
                  ? "Portal access is currently disabled."
                  : "Portal account is active."}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2 min-w-0">
          <div>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{portalAccount?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Invitation sent</dt>
            <dd>{fmtDate(portalAccount?.inviteSentAt ?? null)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Invitation expires</dt>
            <dd>{fmtDate(portalAccount?.inviteExpiresAt ?? null)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last login</dt>
            <dd>{fmtDate(portalAccount?.lastLoginAt ?? null)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Onboarding</dt>
            <dd>
              {portalAccount?.onboardingCompletedAt
                ? `Completed ${fmtDate(portalAccount.onboardingCompletedAt)}`
                : portalAccount
                  ? `Step ${portalAccount.onboardingStep} of 3`
                  : "Not started"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canInvite && status === "no_account" ? (
            <ConfirmAction
              title="Send portal invitation?"
              description="This creates a portal account and emails a secure link. The carer must set their own password."
              actionLabel="Send invitation"
              onConfirm={() => inviteMut.mutate(false)}
              loading={inviteMut.isPending}
            >
              <Button className="h-11 w-full sm:w-auto">Send portal invitation</Button>
            </ConfirmAction>
          ) : null}

          {canResend ? (
            <ConfirmAction
              title="Resend portal invitation?"
              description="This invalidates any previous invitation link and sends a new email."
              actionLabel="Resend"
              onConfirm={() => inviteMut.mutate(true)}
              loading={inviteMut.isPending}
            >
              <Button variant="secondary" className="h-11 w-full sm:w-auto">
                Resend invitation
              </Button>
            </ConfirmAction>
          ) : null}

          {status !== "no_account" && status !== "disabled" ? (
            <ConfirmAction
              title="Disable portal access?"
              description="The carer will not be able to sign in until access is re-enabled."
              actionLabel="Disable access"
              onConfirm={() => disableMut.mutate()}
              loading={disableMut.isPending}
            >
              <Button variant="outline" className="h-11 w-full sm:w-auto">
                Disable portal access
              </Button>
            </ConfirmAction>
          ) : null}

          {status === "disabled" ? (
            <ConfirmAction
              title="Re-enable portal access?"
              description="The carer can sign in again with their existing password."
              actionLabel="Re-enable"
              onConfirm={() => enableMut.mutate()}
              loading={enableMut.isPending}
            >
              <Button className="h-11 w-full sm:w-auto">Re-enable portal access</Button>
            </ConfirmAction>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmAction({
  title,
  description,
  actionLabel,
  onConfirm,
  loading,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild disabled={loading}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
