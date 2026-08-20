import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { activityLogCategoryLabel } from "@/lib/activity-log-labels";
import {
  formatOpsCompactDateTimeToronto,
  formatOpsDateTimeToronto,
} from "@/lib/ops-report-formatters";
import type { ActivityLogItem } from "@/lib/reports-types";

function actorDisplayName(item: ActivityLogItem): string {
  if (item.actor.name) return item.actor.name;
  if (item.actor.type === "system") return "System";
  if (item.actor.type === "unknown") return "Unknown";
  return "Unknown";
}

function actorTypeLabel(type: ActivityLogItem["actor"]["type"]): string | null {
  if (type === "ops_user") return "Ops";
  if (type === "staff") return "Staff";
  if (type === "system") return "System";
  return null;
}

function hasExpandableDetails(item: ActivityLogItem): boolean {
  const metadata = item.metadata;
  if (!metadata) return false;
  return Boolean(
    metadata.changes ||
      metadata.cancellationReasonPreview ||
      metadata.previousStaffId ||
      metadata.newStaffId,
  );
}

function relatedSummary(item: ActivityLogItem): { label: string; href?: string; params?: Record<string, string> }[] {
  const parts: { label: string; href?: string; params?: Record<string, string> }[] = [];
  if (item.staff) {
    parts.push({ label: item.staff.name, href: "/staff/$id", params: { id: item.staff.id } });
  }
  if (item.centre) {
    parts.push({ label: item.centre.name, href: "/centres/$id", params: { id: item.centre.id } });
  }
  if (item.shift) {
    parts.push({
      label: `${item.shift.shiftDate} Shift`,
      href: "/shifts/$id",
      params: { id: item.shift.id },
    });
  }
  return parts.slice(0, 2);
}

function ActivityExpandedDetails({ item }: { item: ActivityLogItem }) {
  const metadata = item.metadata;
  if (!metadata) return null;

  const changes =
    metadata.changes && typeof metadata.changes === "object"
      ? (metadata.changes as Record<string, { from?: unknown; to?: unknown }>)
      : null;
  const cancellationPreview =
    typeof metadata.cancellationReasonPreview === "string"
      ? metadata.cancellationReasonPreview
      : null;

  const rows: { label: string; value: string }[] = [];

  if (changes) {
    for (const [field, value] of Object.entries(changes)) {
      const label = field.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
      rows.push({ label, value: `${String(value.from ?? "—")} → ${String(value.to ?? "—")}` });
    }
  }
  if (typeof metadata.previousStaffId === "string") {
    rows.push({ label: "Previous Staff", value: String(metadata.previousStaffId) });
  }
  if (typeof metadata.newStaffId === "string") {
    rows.push({ label: "New Staff", value: String(metadata.newStaffId) });
  }
  if (cancellationPreview) {
    rows.push({ label: "Cancellation reason", value: cancellationPreview });
  }

  if (rows.length === 0) return null;

  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
          <dd className="mt-0.5 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RelatedLinks({ parts }: { parts: ReturnType<typeof relatedSummary> }) {
  if (parts.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <span className="text-sm text-muted-foreground">
      {parts.map((part, index) => (
        <span key={`${part.label}-${index}`}>
          {index > 0 ? <span className="text-muted-foreground/70"> · </span> : null}
          {part.href && part.params ? (
            <Link to={part.href} params={part.params} className="text-primary hover:underline">
              {part.label}
            </Link>
          ) : (
            part.label
          )}
        </span>
      ))}
    </span>
  );
}

function ExpandButton({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      className="h-8 w-8 shrink-0"
      aria-expanded={expanded}
      aria-label={expanded ? `Hide details for ${label}` : `Show details for ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {expanded ? (
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function ActivityDesktopRow({ item }: { item: ActivityLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = hasExpandableDetails(item);
  const related = relatedSummary(item);
  const actorType = actorTypeLabel(item.actor.type);
  const fullTime = formatOpsDateTimeToronto(item.occurredAt);
  const compactTime = formatOpsCompactDateTimeToronto(item.occurredAt);

  return (
    <>
      <tr className="hover:bg-muted/30">
        <td className="whitespace-nowrap px-3 py-2.5 align-top text-sm text-muted-foreground">
          <time dateTime={item.occurredAt} title={fullTime}>
            {compactTime}
          </time>
        </td>
        <td className="min-w-0 px-3 py-2.5 align-top">
          <p className="font-medium leading-snug">{item.title}</p>
          {item.description ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.description}</p>
          ) : null}
        </td>
        <td className="hidden px-3 py-2.5 align-top md:table-cell">
          <p className="text-sm leading-snug">{actorDisplayName(item)}</p>
          {actorType ? <p className="text-xs text-muted-foreground">{actorType}</p> : null}
        </td>
        <td className="hidden min-w-0 px-3 py-2.5 align-top lg:table-cell">
          <RelatedLinks parts={related} />
        </td>
        <td className="hidden px-3 py-2.5 align-top xl:table-cell">
          <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-medium">
            {activityLogCategoryLabel(item.category)}
          </Badge>
        </td>
        <td className="w-10 px-2 py-2.5 align-top text-right">
          {expandable ? (
            <ExpandButton
              expanded={expanded}
              onToggle={() => setExpanded((value) => !value)}
              label={item.title}
            />
          ) : null}
        </td>
      </tr>
      {expanded && expandable ? (
        <tr className="bg-muted/20">
          <td colSpan={6} className="border-t border-border/60 px-3 py-3">
            <ActivityExpandedDetails item={item} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ActivityMobileRow({ item }: { item: ActivityLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const expandable = hasExpandableDetails(item);
  const related = relatedSummary(item);
  const fullTime = formatOpsDateTimeToronto(item.occurredAt);
  const compactTime = formatOpsCompactDateTimeToronto(item.occurredAt);

  return (
    <div className="border-b border-border/70 px-3 py-2.5 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium leading-snug">{item.title}</p>
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] font-medium">
              {activityLogCategoryLabel(item.category)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={item.occurredAt} title={fullTime}>
              {compactTime}
            </time>
            <span className="text-muted-foreground/70"> · </span>
            {actorDisplayName(item)}
          </p>
          {item.description ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          {related.length > 0 ? (
            <div className="mt-1">
              <RelatedLinks parts={related} />
            </div>
          ) : null}
        </div>
        {expandable ? (
          <ExpandButton
            expanded={expanded}
            onToggle={() => setExpanded((value) => !value)}
            label={item.title}
          />
        ) : null}
      </div>
      {expanded && expandable ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <ActivityExpandedDetails item={item} />
        </div>
      ) : null}
    </div>
  );
}

export function ActivityLogList({ items }: { items: ActivityLogItem[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border/70 bg-card md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="border-b border-border/70 bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Activity</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Actor</th>
              <th className="hidden px-3 py-2 font-medium lg:table-cell">Related</th>
              <th className="hidden px-3 py-2 font-medium xl:table-cell">Category</th>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {items.map((item) => (
              <ActivityDesktopRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-border/70 rounded-lg border border-border/70 bg-card md:hidden">
        {items.map((item) => (
          <ActivityMobileRow key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

export function ActivityLogEmptyState() {
  return (
    <div className="rounded-lg border border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
      No recorded activity matches these filters.
    </div>
  );
}
