import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CentreEmailReviewDialog } from "@/components/shifts/CentreEmailReviewDialog";
import { ApiError } from "@/lib/api";
import { previewBatchCentreEmail } from "@/lib/centre-email-review";
import type { BatchUpdateReadiness } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";
import { useCentreEmailReview } from "@/lib/use-centre-email-review";

export function BatchSendUpdatesConfirmationAction({
  batchId,
  displayReady,
}: {
  batchId: string;
  displayReady: boolean;
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const readinessQ = useQuery({
    queryKey: ["shift-batch-update-readiness", batchId],
    queryFn: () => shiftBatchesApi.getUpdateReadiness(batchId),
    enabled: displayReady,
  });

  const readiness = readinessQ.data;
  const ready = readiness?.ready ?? false;

  const centreReview = useCentreEmailReview({
    open: reviewOpen,
    loadPreview: useCallback(
      (centreEmail) =>
        previewBatchCentreEmail(batchId, {
          variant: "update",
          selectedChangeIds: selectedIds,
          centreEmail,
        }),
      [batchId, selectedIds],
    ),
  });

  const sendM = useMutation({
    mutationFn: (centreEmail: { subject: string; body: string }) =>
      shiftBatchesApi.sendUpdatesConfirmation(
        batchId,
        selectedIds,
        readiness?.pendingChangeRevision,
        centreEmail,
      ),
    onSuccess: () => {
      toast.success("Centre update confirmation scheduled.");
      setDialogOpen(false);
      setReviewOpen(false);
      void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
      void qc.invalidateQueries({ queryKey: ["shift-batch-update-readiness", batchId] });
      void qc.invalidateQueries({ queryKey: ["shift-batch-activity", batchId] });
      void qc.invalidateQueries({ queryKey: ["shifts-feed"] });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        centreReview.setStaleError(
          err.message || "Batch changes were updated while you were reviewing. Refresh and try again.",
        );
        void centreReview.refreshPreview();
        void readinessQ.refetch();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not send update confirmation.");
      void readinessQ.refetch();
    },
  });

  const defaultSelected = useMemo(
    () => readiness?.detectedChanges.filter((c) => c.defaultSelected).map((c) => c.id) ?? [],
    [readiness?.detectedChanges],
  );

  if (!displayReady && !readiness?.stale) return null;

  function openReview() {
    setDialogOpen(false);
    setReviewOpen(true);
  }

  return (
    <div className="space-y-2">
      {displayReady ? (
        <Button
          type="button"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!ready || sendM.isPending}
          onClick={() => {
            setSelectedIds(defaultSelected);
            setDialogOpen(true);
          }}
        >
          Send Updates Confirmation
        </Button>
      ) : readiness?.stale ? (
        <p className="text-sm text-muted-foreground">
          Fill all active shifts before sending a Centre update confirmation.
        </p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Updates Confirmation</DialogTitle>
            <DialogDescription>
              Send an updated consolidated confirmation to{" "}
              {readiness?.primaryContactEmail ?? "the Centre primary contact"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Changes to highlight</p>
            {(readiness?.detectedChanges ?? []).map((change) => (
              <label key={change.id} className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={selectedIds.includes(change.id)}
                  onCheckedChange={(checked) => {
                    setSelectedIds((current) =>
                      checked
                        ? [...current, change.id]
                        : current.filter((id) => id !== change.id),
                    );
                  }}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{change.shiftLabel}</span>
                  <span className="block font-medium text-foreground">{change.label}</span>
                </span>
              </label>
            ))}
            {(readiness?.detectedChanges.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                The email will include the current full shift schedule.
              </p>
            ) : null}
            <Label className="text-xs text-muted-foreground">
              The full current assignment list below is always included regardless of selection.
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!ready || sendM.isPending} onClick={openReview}>
              Continue to email review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CentreEmailReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        preview={centreReview.preview}
        previewLoading={centreReview.previewLoading}
        previewError={centreReview.previewError}
        subject={centreReview.subject}
        body={centreReview.body}
        segments={centreReview.segments}
        onSubjectChange={centreReview.setSubject}
        onBodyChange={centreReview.handleBodyChange}
        submitting={sendM.isPending}
        submitLabel="Send updates"
        staleError={centreReview.staleError}
        onBack={() => {
          setReviewOpen(false);
          setDialogOpen(true);
        }}
        onSubmit={() => sendM.mutate(centreReview.centreEmailPayload)}
      />
    </div>
  );
}
