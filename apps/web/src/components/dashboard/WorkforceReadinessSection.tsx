import { Card } from "@/components/ui/card";
import { DashboardFooterLink, DashboardSection } from "./DashboardPrimitives";
import type { DashboardOverviewResponse } from "@/lib/dashboard-api";
import { complianceHeadline } from "@/lib/dashboard-overview-ui";
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
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt
        className={cn(
          "text-sm",
          emphasis === "warning" ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-semibold tabular-nums",
          emphasis === "warning" && value > 0 ? "text-warning" : "text-foreground",
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

  return (
    <DashboardSection
      id="workforce-readiness"
      title="Workforce readiness"
      description="Document compliance and portal account health."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Document compliance</h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {headline.value}
          </p>
          <p className="text-sm text-muted-foreground">{headline.context}</p>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Needs action
          </p>
          <dl className="mt-1 divide-y divide-border/70">
            <StatRow label="Pending review" value={documents.pendingReview} emphasis="warning" />
            <StatRow label="Issue flagged" value={documents.issueFlagged} emphasis="warning" />
            <StatRow label="Expired" value={documents.expired} emphasis="warning" />
          </dl>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming
          </p>
          <dl className="mt-1">
            <StatRow label="Expiring soon" value={documents.expiringSoon} emphasis="muted" />
          </dl>

          <p className="mt-3 text-xs text-muted-foreground">
            COVID-19 vaccination is optional and does not affect compliance.
          </p>

          <div className="mt-4">
            <DashboardFooterLink to="/reports/documents">
              View document compliance
            </DashboardFooterLink>
          </div>
        </Card>

        <Card className="border-border/70 p-4 shadow-xs">
          <h3 className="text-sm font-semibold text-foreground">Staff readiness</h3>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">
            {staffReadiness.activeStaff}
          </p>
          <p className="text-sm text-muted-foreground">
            Active staff · availability and documents still determine who can be assigned
          </p>

          <dl className="mt-4 divide-y divide-border/70">
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

          <div className="mt-4">
            <DashboardFooterLink to="/staff">View staff</DashboardFooterLink>
          </div>
        </Card>
      </div>
    </DashboardSection>
  );
}
