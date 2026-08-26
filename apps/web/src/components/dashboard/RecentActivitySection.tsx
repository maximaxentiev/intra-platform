import { Link } from "@tanstack/react-router";
import { DashboardEmpty, DashboardFooterLink, DashboardSection } from "./DashboardPrimitives";
import type { ActivityLogItem } from "@/lib/reports-types";
import { activityActorLine } from "@/lib/dashboard-overview-ui";

export function RecentActivitySection({ items }: { items: ActivityLogItem[] }) {
  return (
    <DashboardSection
      id="recent-activity"
      title="Recent activity"
      action={<DashboardFooterLink to="/reports/activity">View activity log</DashboardFooterLink>}
    >
      {items.length === 0 ? (
        <DashboardEmpty title="No recent activity" />
      ) : (
        <ol className="divide-y divide-border border-y border-border">
          {items.map((item) => (
            <li key={item.id} className="flex gap-2.5 py-2">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                aria-hidden="true"
              />
              <div className="min-w-0 leading-snug">
                <p className="text-sm font-medium text-foreground">
                  {item.title}
                  {item.description && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      — {item.description}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{activityActorLine(item)}</span>
                  {item.shift && (
                    <Link
                      to="/shifts/$id"
                      params={{ id: item.shift.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      Shift
                    </Link>
                  )}
                  {item.staff && (
                    <Link
                      to="/staff/$id"
                      params={{ id: item.staff.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.staff.name}
                    </Link>
                  )}
                  {item.centre && (
                    <Link
                      to="/centres/$id"
                      params={{ id: item.centre.id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.centre.name}
                    </Link>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </DashboardSection>
  );
}
