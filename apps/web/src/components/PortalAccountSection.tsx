import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { staffApi, type PortalAccountInfo, type PortalInvitationResult } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PortalStatusBadge } from "@/components/PortalStatusBadge";
import { PropertyList, SectionCard, type PropertyItem } from "@/components/ui-kit";
import { Loader2 } from "lucide-react";
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
import { type PortalAccountDisplayStatus } from "@/lib/portal-account-status";
import { formatDateTime, onboardingSummary, portalMetaVisibility } from "@/lib/staff-detail-ui";

const STATE_COPY: Record<PortalAccountDisplayStatus, string> = {
  no_account: "No carer portal account yet. Send an invitation so they can complete onboarding.",
  invited: "Invitation sent — waiting for them to set a password.",
  incomplete: "Signed in, but onboarding is not finished yet.",
  disabled: "Portal access is currently disabled.",
  active: "Portal account is active.",
};

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

  // Unchanged API conditions.
  const canInvite =
    status === "no_account" || status === "invited" || status === "incomplete" || status === "active";
  const canResend = status !== "no_account" && status !== "disabled";
  const busy = inviteMut.isPending || disableMut.isPending || enableMut.isPending;

  const show = portalMetaVisibility(portalAccount);
  const onboarding = onboardingSummary(portalAccount);
  const items: PropertyItem[] = [];
  if (show.email) items.push({ label: "Email", value: portalAccount?.email, className: "break-all" });
  if (show.inviteSentAt)
    items.push({ label: "Invitation sent", value: formatDateTime(portalAccount?.inviteSentAt) });
  if (show.inviteExpiresAt)
    items.push({ label: "Invitation expires", value: formatDateTime(portalAccount?.inviteExpiresAt) });
  if (show.lastLoginAt)
    items.push({ label: "Last login", value: formatDateTime(portalAccount?.lastLoginAt) });
  if (show.onboarding)
    items.push({
      label: "Onboarding",
      value: portalAccount?.onboardingCompletedAt
        ? `Completed ${formatDateTime(portalAccount.onboardingCompletedAt)}`
        : onboarding.label,
    });

  return (
    <SectionCard
      id="portal-account"
      title={
        <span className="flex flex-wrap items-center gap-2">
          Portal account
          <PortalStatusBadge status={status} size="xs" />
        </span>
      }
      description={STATE_COPY[status]}
    >
      <div className="space-y-4">
        {items.length > 0 && <PropertyList items={items} />}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {canInvite && status === "no_account" ? (
            <ConfirmAction
              title="Send portal invitation?"
              description="This creates a portal account and emails a secure link. The carer must set their own password."
              actionLabel="Send invitation"
              onConfirm={() => inviteMut.mutate(false)}
              loading={inviteMut.isPending}
            >
              <Button size="sm" className="h-9 w-full sm:w-auto" disabled={busy}>
                {inviteMut.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Send invitation
              </Button>
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
              <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" disabled={busy}>
                {inviteMut.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
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
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:ml-auto sm:w-auto"
                disabled={busy}
              >
                {disableMut.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Disable access
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
              <Button size="sm" className="h-9 w-full sm:w-auto" disabled={busy}>
                {enableMut.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                )}
                Re-enable access
              </Button>
            </ConfirmAction>
          ) : null}
        </div>
      </div>
    </SectionCard>
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
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
