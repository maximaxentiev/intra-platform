import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BatchProgressEmailStatus } from "@/components/shifts/BatchProgressEmailStatus";
import { BatchWorkspaceChildCard } from "@/components/shifts/BatchWorkspaceChildCard";
import { DetailLoading } from "@/components/DetailLoading";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { BackLink } from "@/components/ui-kit";
import {
  computeBatchProgress,
  deriveBatchDisplayState,
  formatBatchDateRange,
} from "@/lib/batch-shift-ui";
import { shiftBatchesApi } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/shifts/batches/$id")({
  component: BatchWorkspace,
});

function BatchWorkspace() {
  const { id } = Route.useParams();
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  const batchQ = useQuery({
    queryKey: ["shift-batch", id],
    queryFn: () => shiftBatchesApi.getWorkspace(id),
  });

  const workspace = batchQ.data;
  const progress = useMemo(
    () => computeBatchProgress(workspace?.shifts ?? []),
    [workspace?.shifts],
  );
  const displayState = deriveBatchDisplayState(workspace?.requestCompletedAt ?? null, progress);
  const dateRange = formatBatchDateRange(workspace?.shifts ?? []);

  if (!workspace) return <DetailLoading />;

  return (
    <div className="max-w-[960px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />

      <PageHeader
        title={workspace.centreName}
        subtitle="Batch Request"
        actions={
          displayState === "completed" ? (
            <StatusBadge status="completed">Completed</StatusBadge>
          ) : displayState === "ready" ? (
            <StatusBadge status="filled">Ready</StatusBadge>
          ) : (
            <StatusBadge status="pending">Open</StatusBadge>
          )
        }
      />

      <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            {dateRange ? (
              <p className="text-sm text-muted-foreground">{dateRange}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No shifts yet</p>
            )}
            <p className="text-lg font-semibold text-foreground">
              {progress.fulfilledCount} of {progress.activeTotal} filled
              {progress.cancelledCount > 0 ? ` · ${progress.cancelledCount} cancelled` : ""}
            </p>
            <p className="text-sm text-muted-foreground">{progress.percentage}% progress</p>
            <BatchProgressEmailStatus
              batchId={workspace.id}
              status={workspace.progressEmailStatus}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {workspace.shifts.length} shift{workspace.shifts.length === 1 ? "" : "s"} total
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {workspace.shifts.map((shift, index) => (
          <BatchWorkspaceChildCard
            key={shift.id}
            shift={shift}
            index={index}
            batchId={workspace.id}
            requestCompletedAt={workspace.requestCompletedAt}
            centreName={workspace.centreName}
            expanded={expandedShiftId === shift.id}
            onToggle={() =>
              setExpandedShiftId((current) => (current === shift.id ? null : shift.id))
            }
          />
        ))}
      </div>

      {workspace.shifts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This batch has no child shifts yet.{" "}
          <Link to="/shifts/batches/new" className="underline underline-offset-2">
            Create another batch
          </Link>
        </p>
      ) : null}
    </div>
  );
}
