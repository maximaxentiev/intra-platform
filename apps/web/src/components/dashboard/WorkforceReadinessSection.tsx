import { Card } from "@/components/ui/card";
import { DashboardFooterLink, DashboardSection } from "./DashboardPrimitives";
import type { DashboardOverviewResponse } from "@/lib/dashboard-api";
import {
  complianceHeadline,
  staffReadinessHeadline,
  unexplainedComplianceNote,
} from "@/lib/dashboard-overview-ui";
import { cn } from "@/lib/utils";

function StatRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: "warning" | "muted";
}) {
  const isZero = value === 0;
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt
        className={cn(
          "text-sm",
          emphasis === "warning" && !isZero
            ? "font-medium text-foreground"
            : "text-muted-foreground",
          isZero && "opacity-70",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-semibold tabular-nums",
          emphasis === "warning" && !isZero ? "text-warning" : "text-foreground",
          isZero && "font-normal text-muted-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function WorkforceReadinessSection({
  documents,
  staffReadiness,
}: {
  documents: DashboardOverviewResponse["documents"];
  staffReadiness: DashboardOverviewResponse["staffReadiness"];
}) {
  const headline = complianceHeadline(documents);
  const gapNote = unexplainedComplianceNote(documents);

  return (
    <DashboardSection id="workforce-readiness" title="Workforce readiness">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 p-4 shadow-xs">
          <h3 className="text-base font-semibold text-foreground">Document compliance</h3>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
            <span className="tabular-nums">{headline.value}</span>{" "}
            <span className="text-sm font-normal text-muted-foreground">{headline.context}</span>
          </p>

          {gapNote && <p className="mt-1.5 text-sm text-muted-foreground">{gapNote}</p>}

          <dl className="mt-3 divide-y divide-border/60">
            <StatRow label="Pending review" value={documents.pendingReview} emphasis="warning" />
            <StatRow label="Issue flagged" value={documents.issueFlagged} emphasis="warning" />
            <StatRow label="Expired" value={documents.expired} emphasis="warning" />
            <StatRow label="Expiring soon" value={documents.expiringSoon} emphasis="muted" />
          </dl>

          <div className="mt-3">
            <DashboardFooterLink to="/reports/documents">
              View document compliance
            </DashboardFooterLink>
          </div>
        </Card>

        <Card className="border-border/70 p-4 shadow-xs">
          <h3 className="text-base font-semibold text-foreground">Staff readiness</h3>
          <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums text-foreground">
            {staffReadinessHeadline(staffReadiness.staffCount)}
          </p>
          <p className="text-sm text-muted-foreground">
            Availability and documents still determine who can be assigned.
          </p>

          <dl className="mt-3 divide-y divide-border/60">
            <StatRow label="Portal active" value={staffReadiness.portalActive} emphasis="muted" />
            <StatRow label="No account" value={staffReadiness.noAccount} emphasis="muted" />
            <StatRow label="Invited" value={staffReadiness.invited} emphasis="warning" />
            <StatRow
              label="Onboarding incomplete"
              value={staffReadiness.incomplete}
              emphasis="warning"
            />
            <StatRow label="Portal disabled" value={staffReadiness.disabled} emphasis="warning" />
          </dl>

          <div className="mt-3">
            <DashboardFooterLink to="/staff">View staff</DashboardFooterLink>
          </div>
        </Card>
      </div>
    </DashboardSection>
  );
}
