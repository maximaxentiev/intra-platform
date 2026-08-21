import type { PortalAccountInfo } from "@/lib/db";
import { PortalStatusBadge } from "@/components/PortalStatusBadge";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { onboardingSummary } from "@/lib/staff-detail-ui";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

/**
 * Compact operational overview. Server-authoritative values only:
 * employment status, portal-account state, portal onboarding fields and the
 * documents API's own `documentStatus`.
 */
export function StaffOperationalSummary({
  employmentStatus,
  portalAccount,
  documentStatus,
  documentsLoading,
  documentsUnavailable,
}: {
  employmentStatus: string;
  portalAccount: PortalAccountInfo | null;
  documentStatus?: string;
  documentsLoading?: boolean;
  documentsUnavailable?: boolean;
}) {
  const portalStatus = portalAccount?.accountStatus ?? "no_account";
  const onboarding = onboardingSummary(portalAccount);

  return (
    <Card className="gap-0 border-border/70 px-4 py-3 shadow-xs">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Row label="Employment">
          <StatusBadge
            status={employmentStatus === "active" ? "active" : "inactive"}
            size="xs"
          >
            {employmentStatus}
          </StatusBadge>
        </Row>
        <Row label="Portal">
          <PortalStatusBadge status={portalStatus} size="xs" />
        </Row>
        <Row label="Onboarding">
          <span
            className={
              onboarding.tone === "success"
                ? "text-sm font-medium text-success"
                : onboarding.tone === "info"
                  ? "text-sm font-medium text-foreground"
                  : "text-sm text-muted-foreground"
            }
          >
            {onboarding.label}
          </span>
        </Row>
        <Row label="Documents">
          {documentsLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : documentsUnavailable || !documentStatus ? (
            <span className="text-sm text-muted-foreground">Unavailable</span>
          ) : (
            <DocumentStatusBadge status={documentStatus} size="xs" />
          )}
        </Row>
      </dl>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 sm:justify-start">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-24 sm:shrink-0">
        {label}
      </dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  );
}
