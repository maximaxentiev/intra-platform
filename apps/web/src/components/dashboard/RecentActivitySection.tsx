import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { DashboardEmpty, DashboardFooterLink, DashboardSection } from "./DashboardPrimitives";
import type { ActivityLogItem } from "@/lib/reports-types";
import { activityActorLine } from "@/lib/dashboard-overview-ui";

export function RecentActivitySection({ items }: { items: ActivityLogItem[] }) {
  return (
    <DashboardSection
      id="recent-activity"
      title="Recent activity"
      description="Latest changes across shifts, staff and documents."
    >
      {items.length === 0 ? (
        <DashboardEmpty title="No recent activity" />
      ) : (
        <Card className="border-border/70 py-0 shadow-xs">
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 p-4">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description && (
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {activityActorLine(item)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {item.shift && (
                      <Link
                        to="/shifts/$id"
                        params={{ id: item.shift.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        View shift
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
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-border px-4 py-3">
            <DashboardFooterLink to="/reports/activity">View activity log</DashboardFooterLink>
          </div>
        </Card>
      )}
    </DashboardSection>
  );
}
