import { ActivityFeed, ActivityItem } from "@/components/ui-kit";
import {
  formatOpsCompactDateTimeToronto,
  formatOpsDateTimeToronto,
} from "@/lib/ops-report-formatters";
import type { ActivityLogItem } from "@/lib/reports-types";

function activityDetail(item: ActivityLogItem): string | null {
  if (item.description) return item.description;
  if (item.actor.name) {
    if (item.actor.type === "ops_user") return item.actor.name;
    return item.actor.name;
  }
  if (item.actor.type === "system") return "System";
  return null;
}

export function ShiftActivityFeed({ items }: { items: ActivityLogItem[] }) {
  return (
    <ActivityFeed bordered className="min-w-0">
      {items.map((item) => (
        <ActivityItem
          key={item.id}
          density="detailed"
          className="min-w-0 px-1"
          title={item.title}
          description={activityDetail(item)}
          timestamp={
            <time
              dateTime={item.occurredAt}
              title={formatOpsDateTimeToronto(item.occurredAt)}
              className="whitespace-nowrap"
            >
              {formatOpsCompactDateTimeToronto(item.occurredAt)}
            </time>
          }
        />
      ))}
    </ActivityFeed>
  );
}
