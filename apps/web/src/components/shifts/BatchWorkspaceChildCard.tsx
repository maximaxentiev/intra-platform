import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { BatchWorkspaceExpandedChild } from "@/components/shifts/BatchWorkspaceExpandedChild";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtTime, type ShiftBatchChildSummary } from "@/lib/db";
import { cn } from "@/lib/utils";

export function BatchWorkspaceChildCard({
  shift,
  index,
  expanded,
  batchId,
  requestCompletedAt,
  batchCancelled = false,
  centreName,
  onToggle,
}: {
  shift: ShiftBatchChildSummary;
  index: number;
  expanded: boolean;
  batchId: string;
  requestCompletedAt: string | null;
  batchCancelled?: boolean;
  centreName: string;
  onToggle: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-primary/20 shadow-xs transition-colors",
        "bg-[#e8eefe]",
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
        <div id={`batch-child-panel-${shift.id}`} className="bg-[#e8eefe]">
          <BatchWorkspaceExpandedChild
            shiftId={shift.id}
            batchId={batchId}
            requestCompletedAt={requestCompletedAt}
            batchCancelled={batchCancelled}
            centreName={centreName}
            summary={shift}
          />
        </div>
      ) : null}
    </article>
  );
}
