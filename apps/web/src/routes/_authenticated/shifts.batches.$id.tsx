import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { BatchActivityLogPanel } from "@/components/shifts/BatchActivityLogPanel";
import { BatchAddShiftsPanel } from "@/components/shifts/BatchAddShiftsPanel";
import { BatchCancelBatchDialog } from "@/components/shifts/BatchCancelBatchDialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  batchAssignedCarerSummaries,
  computeBatchProgress,
  deriveBatchDisplayState,
  resolveBatchCancelCase,
} from "@/lib/batch-shift-ui";
import { shiftBatchesApi } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/shifts/batches/$id")({
  component: BatchWorkspace,
});

function BatchWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [addShiftsOpen, setAddShiftsOpen] = useState(false);
  const [cancelBatchOpen, setCancelBatchOpen] = useState(false);
  const [cancellingBatch, setCancellingBatch] = useState(false);

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
      cancelledAt: workspace?.cancelledAt,
    },
  );
  const isBatchCancelled = displayState === "cancelled";
  const canAddShifts =
    workspace != null && workspace.requestCompletedAt == null && !isBatchCancelled;
  const cancelCase = workspace
    ? resolveBatchCancelCase({
        requestCompletedAt: workspace.requestCompletedAt,
        confirmationRevision: workspace.confirmationRevision,
        shifts: workspace.shifts,
      })
    : "A";
  const assignedCarerSummaries = useMemo(
    () => batchAssignedCarerSummaries(workspace?.shifts ?? []),
    [workspace?.shifts],
  );

  if (!workspace) return <DetailLoading />;

  const stateLabel =
    displayState === "cancelled"
      ? "Cancelled"
      : displayState === "completed"
        ? "Completed"
        : displayState === "ready_to_send_updates"
          ? "Ready to send updates"
          : displayState === "updates_required"
            ? "Updates required"
            : displayState === "ready"
              ? "Ready"
              : "Open";

  const confirmationPanelCopy = isBatchCancelled
    ? null
    : displayState === "updates_required" || displayState === "ready_to_send_updates"
      ? "Centre confirmation needs updating"
      : workspace.requestCompletedAt && workspace.pendingChangeRevision === 0
        ? "Centre confirmation up to date"
        : workspace.requestCompletedAt
          ? "Final Centre confirmation sent"
          : null;

  async function handleCancelBatch(input: {
    reason: string;
    communications?: { centre: boolean; carer: boolean };
  }) {
    setCancellingBatch(true);
    try {
      await shiftBatchesApi.cancelBatch(workspace.id, {
        cancellationReason: input.reason,
        communications: input.communications,
      });
      setCancelBatchOpen(false);
      await Promise.all([
        batchQ.refetch(),
        qc.invalidateQueries({ queryKey: ["shifts-feed"] }),
      ]);
    } finally {
      setCancellingBatch(false);
    }
  }

  return (
    <div className="max-w-[960px] space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />

      <PageHeader
        title={workspace.centreName}
        actions={
          <>
            {canAddShifts ? (
              <Button type="button" onClick={() => setAddShiftsOpen(true)}>
                Add shifts
              </Button>
            ) : null}
            {!isBatchCancelled ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="More batch actions"
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      setCancelBatchOpen(true);
                    }}
                  >
                    Cancel batch
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
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
              {isBatchCancelled ? (
                <>
                  <p className="text-2xl font-semibold tracking-tight text-white">Cancelled</p>
                  {workspace.cancellationReason ? (
                    <p className="mt-2 text-sm text-white/90">{workspace.cancellationReason}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold tracking-tight text-white">
                    {progress.fulfilledCount} of {progress.activeTotal} filled
                  </p>
                  <p className="mt-1 text-lg text-white/95">{progress.percentage}% progress</p>
                </>
              )}
            </div>
            <StatusBadge
              status={
                displayState === "cancelled"
                  ? "pending"
                  : displayState === "completed"
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
          {!isBatchCancelled && progress.cancelledCount > 0 ? (
            <p className="text-sm text-white/90">
              {progress.cancelledCount} cancelled shift{progress.cancelledCount === 1 ? "" : "s"}{" "}
              excluded from progress
            </p>
          ) : null}
          {!isBatchCancelled ? (
            <>
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
            </>
          ) : null}
          {confirmationPanelCopy ? (
            <p className="text-sm font-medium text-white">{confirmationPanelCopy}</p>
          ) : null}
          {!isBatchCancelled && workspace.requestCompletedAt ? (
            <p className="text-sm text-white/90">
              First completed {new Date(workspace.requestCompletedAt).toLocaleString()}
              {workspace.lastConfirmationScheduledAt &&
              workspace.lastConfirmationScheduledAt !== workspace.requestCompletedAt
                ? ` · Last Centre confirmation ${new Date(workspace.lastConfirmationScheduledAt).toLocaleString()}`
                : ""}
            </p>
          ) : null}
          {isBatchCancelled && workspace.cancelledAt ? (
            <p className="text-sm text-white/90">
              Cancelled {new Date(workspace.cancelledAt).toLocaleString()}
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
            batchCancelled={isBatchCancelled}
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

      <BatchCancelBatchDialog
        open={cancelBatchOpen}
        onOpenChange={setCancelBatchOpen}
        cancelCase={cancelCase}
        assignedCarerSummaries={assignedCarerSummaries}
        submitting={cancellingBatch}
        onConfirm={handleCancelBatch}
      />
    </div>
  );
}
