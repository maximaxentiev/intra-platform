import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BatchActivityLogPanel } from "@/components/shifts/BatchActivityLogPanel";
import { BatchAddShiftsPanel } from "@/components/shifts/BatchAddShiftsPanel";
import { BatchCompleteRequestAction } from "@/components/shifts/BatchCompleteRequestAction";
import { BatchFinalConfirmationStatus } from "@/components/shifts/BatchFinalConfirmationStatus";
import { BatchProgressEmailStatus } from "@/components/shifts/BatchProgressEmailStatus";
import { BatchWorkspaceChildCard } from "@/components/shifts/BatchWorkspaceChildCard";
import { DetailLoading } from "@/components/DetailLoading";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { BackLink } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  computeBatchProgress,
  deriveBatchDisplayState,
} from "@/lib/batch-shift-ui";
import { shiftBatchesApi } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/shifts/batches/$id")({
  component: BatchWorkspace,
});

function BatchWorkspace() {
  const { id } = Route.useParams();
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [addShiftsOpen, setAddShiftsOpen] = useState(false);

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
  const canAddShifts = workspace != null && workspace.requestCompletedAt == null;

  if (!workspace) return <DetailLoading />;

  const stateLabel =
    displayState === "completed" ? "Completed" : displayState === "ready" ? "Ready" : "Open";

  return (
    <div className="max-w-[960px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />

      <PageHeader
        title={workspace.centreName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canAddShifts ? (
              <Button type="button" onClick={() => setAddShiftsOpen(true)}>
                Add shifts
              </Button>
            ) : null}
            {displayState === "completed" ? (
              <StatusBadge status="completed">Completed</StatusBadge>
            ) : displayState === "ready" ? (
              <StatusBadge status="filled">Ready</StatusBadge>
            ) : (
              <StatusBadge status="pending">Open</StatusBadge>
            )}
          </div>
        }
      />

      {displayState !== "completed" ? (
        <BatchCompleteRequestAction
          batchId={workspace.id}
          displayReady={displayState === "ready"}
          requestCompletedAt={workspace.requestCompletedAt}
        />
      ) : null}

      <div className="rounded-xl bg-surface-brand-dusk p-5 text-primary-foreground shadow-md">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {progress.fulfilledCount} of {progress.activeTotal} filled
              </p>
              <p className="mt-1 text-lg text-primary-foreground/90">{progress.percentage}% progress</p>
            </div>
            <StatusBadge
              status={
                displayState === "completed"
                  ? "completed"
                  : displayState === "ready"
                    ? "filled"
                    : "pending"
              }
              className="border-white/20 bg-white/10 text-primary-foreground"
            >
              {stateLabel}
            </StatusBadge>
          </div>
          {progress.cancelledCount > 0 ? (
            <p className="text-sm text-primary-foreground/80">
              {progress.cancelledCount} cancelled shift{progress.cancelledCount === 1 ? "" : "s"} excluded from progress
            </p>
          ) : null}
          <BatchProgressEmailStatus
            batchId={workspace.id}
            status={workspace.progressEmailStatus}
            requestCompletedAt={workspace.requestCompletedAt}
          />
          <BatchFinalConfirmationStatus
            batchId={workspace.id}
            status={workspace.finalConfirmationStatus}
            requestCompletedAt={workspace.requestCompletedAt}
          />
          {workspace.requestCompletedAt ? (
            <p className="text-sm text-primary-foreground/80">
              Completed {new Date(workspace.requestCompletedAt).toLocaleString()}
            </p>
          ) : null}
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
          {canAddShifts ? (
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => setAddShiftsOpen(true)}
            >
              Add shifts
            </button>
          ) : (
            <Link to="/shifts/batches/new" className="underline underline-offset-2">
              Create another batch
            </Link>
          )}
        </p>
      ) : null}

      <BatchActivityLogPanel batchId={workspace.id} />

      <Dialog open={addShiftsOpen} onOpenChange={setAddShiftsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add shifts to batch</DialogTitle>
          </DialogHeader>
          <BatchAddShiftsPanel
            batchId={workspace.id}
            centreName={workspace.centreName}
            onClose={() => setAddShiftsOpen(false)}
            onSuccess={() => {
              void batchQ.refetch();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
