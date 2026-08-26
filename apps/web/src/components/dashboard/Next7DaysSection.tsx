import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardFooterLink, DashboardSection } from "./DashboardPrimitives";
import type { DashboardOverviewResponse } from "@/lib/dashboard-api";
import {
  formatFillRate,
  formatShiftClock,
  formatUpcomingDateLabel,
  next7DaysCoverageMessage,
  next7DaysShiftsSearch,
} from "@/lib/dashboard-overview-ui";

export function Next7DaysSection({
  next7Days,
  today,
}: {
  next7Days: DashboardOverviewResponse["next7Days"];
  today: string;
}) {
  const summary = [
    { label: "Upcoming shifts", value: String(next7Days.total) },
    { label: "Still pending", value: String(next7Days.pending) },
    { label: "Fill rate", value: formatFillRate(next7Days.fillRate) },
  ];

  return (
    <DashboardSection id="next-7-days" title="Next 7 days">
      <Card className="border-border/70 py-0 shadow-xs">
        <dl className="grid grid-cols-3 divide-x divide-border border-b border-border">
          {summary.map((item) => (
            <div key={item.label} className="px-4 py-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        {next7Days.pendingShifts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {next7DaysCoverageMessage(next7Days) ?? "No pending shifts to assign."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {next7Days.pendingShifts.map((shift) => (
              <li
                key={shift.shiftId}
                className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatUpcomingDateLabel(shift.shiftDate, {
                      today,
                      tomorrow: next7Days.dateFrom,
                    })}{" "}
                    · {formatShiftClock(shift.startTime)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {shift.centreName} · {shift.role}
                  </p>
                  <StatusBadge status="pending" size="xs" className="mt-1" />
                </div>
                <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                  <Link to="/shifts/$id" params={{ id: shift.shiftId }}>
                    Assign
                    <span className="sr-only"> shift at {shift.centreName}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-border px-4 py-3">
          {next7Days.hasMorePendingShifts ? (
            <DashboardFooterLink
              to="/shifts"
              search={next7DaysShiftsSearch(next7Days, "pending")}
            >
              View all pending shifts
            </DashboardFooterLink>
          ) : (
            <DashboardFooterLink to="/shifts" search={next7DaysShiftsSearch(next7Days)}>
              View upcoming shifts
            </DashboardFooterLink>
          )}
        </div>
      </Card>
    </DashboardSection>
  );
}
