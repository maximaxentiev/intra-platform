import { ChevronDown } from "lucide-react";
import { BatchWorkspaceExpandedChild } from "@/components/shifts/BatchWorkspaceExpandedChild";
import { StatusBadge } from "@/components/StatusBadge";
import { batchChildAssigneeLabel } from "@/lib/batch-shift-ui";
import { fmtTime, type ShiftBatchChildSummary } from "@/lib/db";
import { formatShiftRoleLabel } from "@/lib/shift-role-ui";
import { cn } from "@/lib/utils";

export function BatchWorkspaceChildCard({
  shift,
  index,
  expanded,
  batchId,
  requestCompletedAt,
  centreName,
  onToggle,
}: {
  shift: ShiftBatchChildSummary;
  index: number;
  expanded: boolean;
  batchId: string;
  requestCompletedAt: string | null;
  centreName: string;
  onToggle: () => void;
}) {
  const assignee = batchChildAssigneeLabel(shift);

  return (
    <article
      className={cn(
        "rounded-xl border shadow-xs transition-colors",
        expanded
          ? "border-primary/25 bg-primary/[0.05] ring-1 ring-primary/15"
          : "border-primary/10 bg-primary/[0.035]",
      )}
      data-testid={`batch-child-${shift.id}`}
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
        aria-controls={`batch-child-panel-${shift.id}`}
        onClick={onToggle}
      >
        <span className="mt-0.5 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          #{index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-foreground">
              {shift.shiftDate} · {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
            </p>
            <StatusBadge status={shift.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatShiftRoleLabel(shift.roleNeeded)} ·{" "}
            {shift.addedToStaffpoint ? "Staffpoint" : "Not on Staffpoint"}
            {assignee ? ` · ${assignee}` : " · Unassigned"}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div id={`batch-child-panel-${shift.id}`}>
          <BatchWorkspaceExpandedChild
            shiftId={shift.id}
            batchId={batchId}
            requestCompletedAt={requestCompletedAt}
            centreName={centreName}
            summary={shift}
          />
        </div>
      ) : null}
    </article>
  );
}
