import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BatchActivityLogPanel } from "@/components/shifts/BatchActivityLogPanel";
import { BatchAddShiftsPanel } from "@/components/shifts/BatchAddShiftsPanel";
import { BatchCompleteRequestAction } from "@/components/shifts/BatchCompleteRequestAction";
import { BatchSendUpdatesConfirmationAction } from "@/components/shifts/BatchSendUpdatesConfirmationAction";
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
  const displayState = deriveBatchDisplayState(
    workspace?.requestCompletedAt ?? null,
    progress,
    {
      confirmationUiState: workspace?.confirmationUiState,
      pendingChangeRevision: workspace?.pendingChangeRevision,
    },
  );
  const canAddShifts = workspace != null && workspace.requestCompletedAt == null;

  if (!workspace) return <DetailLoading />;

  const stateLabel =
    displayState === "completed"
      ? "Completed"
      : displayState === "ready_to_send_updates"
        ? "Ready to send updates"
        : displayState === "updates_required"
          ? "Updates required"
          : displayState === "ready"
            ? "Ready"
            : "Open";

  const confirmationPanelCopy =
    displayState === "updates_required" || displayState === "ready_to_send_updates"
      ? "Centre confirmation needs updating"
      : workspace.requestCompletedAt && workspace.pendingChangeRevision === 0
        ? "Centre confirmation up to date"
        : workspace.requestCompletedAt
          ? "Final Centre confirmation sent"
          : null;

  return (
    <div className="max-w-[960px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />

      <PageHeader
        title={workspace.centreName}
        actions={
          canAddShifts ? (
            <Button type="button" onClick={() => setAddShiftsOpen(true)}>
              Add shifts
            </Button>
          ) : null
        }
      />

      {displayState === "ready" ? (
        <BatchCompleteRequestAction
          batchId={workspace.id}
          displayReady={displayState === "ready"}
          requestCompletedAt={workspace.requestCompletedAt}
        />
      ) : null}

      {displayState === "ready_to_send_updates" ? (
        <BatchSendUpdatesConfirmationAction batchId={workspace.id} displayReady />
      ) : displayState === "updates_required" ? (
        <BatchSendUpdatesConfirmationAction batchId={workspace.id} displayReady={false} />
      ) : null}

      <div className="rounded-xl bg-surface-brand-dusk p-5 text-white shadow-md">
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-white">
                {progress.fulfilledCount} of {progress.activeTotal} filled
              </p>
              <p className="mt-1 text-lg text-white/95">{progress.percentage}% progress</p>
            </div>
            <StatusBadge
              status={
                displayState === "completed"
                  ? "completed"
                  : displayState === "ready"
                    ? "filled"
                    : "pending"
              }
              className="border-white/30 bg-white/15 text-white"
            >
              {stateLabel}
            </StatusBadge>
          </div>
          {progress.cancelledCount > 0 ? (
            <p className="text-sm text-white/90">
              {progress.cancelledCount} cancelled shift{progress.cancelledCount === 1 ? "" : "s"} excluded from progress
            </p>
          ) : null}
          <BatchProgressEmailStatus
            batchId={workspace.id}
            status={workspace.progressEmailStatus}
            requestCompletedAt={workspace.requestCompletedAt}
            tone="onDark"
          />
          <BatchFinalConfirmationStatus
            batchId={workspace.id}
            status={workspace.finalConfirmationStatus}
            requestCompletedAt={workspace.requestCompletedAt}
            tone="onDark"
          />
          {confirmationPanelCopy ? (
            <p className="text-sm font-medium text-white">{confirmationPanelCopy}</p>
          ) : null}
          {workspace.requestCompletedAt ? (
            <p className="text-sm text-white/90">
              First completed {new Date(workspace.requestCompletedAt).toLocaleString()}
              {workspace.lastConfirmationScheduledAt &&
              workspace.lastConfirmationScheduledAt !== workspace.requestCompletedAt
                ? ` · Last Centre confirmation ${new Date(workspace.lastConfirmationScheduledAt).toLocaleString()}`
                : ""}
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
