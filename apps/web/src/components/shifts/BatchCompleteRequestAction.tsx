import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CentreEmailReviewDialog } from "@/components/shifts/CentreEmailReviewDialog";
import { ApiError } from "@/lib/api";
import { previewBatchCentreEmail } from "@/lib/centre-email-review";
import type { BatchCompletionReadiness } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";
import { useCentreEmailReview } from "@/lib/use-centre-email-review";

export function BatchCompleteRequestAction({
  batchId,
  displayReady,
  requestCompletedAt,
}: {
  batchId: string;
  displayReady: boolean;
  requestCompletedAt: string | null;
}) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [conflictBlockers, setConflictBlockers] = useState<
    BatchCompletionReadiness["blockers"] | null
  >(null);

  const readinessQ = useQuery({
    queryKey: ["shift-batch-completion-readiness", batchId],
    queryFn: () => shiftBatchesApi.getCompletionReadiness(batchId),
    enabled: !requestCompletedAt,
  });

  const centreReview = useCentreEmailReview({
    open: reviewOpen,
    loadPreview: useCallback(
      (centreEmail) => previewBatchCentreEmail(batchId, { variant: "final", centreEmail }),
      [batchId],
    ),
  });

  const completeM = useMutation({
    mutationFn: (centreEmail: { subject: string; body: string }) =>
      shiftBatchesApi.completeRequest(batchId, centreEmail),
    onSuccess: () => {
      toast.success("Batch Request completed.");
      setDialogOpen(false);
      setReviewOpen(false);
      setConflictBlockers(null);
      void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
      void qc.invalidateQueries({ queryKey: ["shift-batch-completion-readiness", batchId] });
      void qc.invalidateQueries({ queryKey: ["shift-batch-activity", batchId] });
      void qc.invalidateQueries({ queryKey: ["shifts-feed"] });
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && err.status === 409) {
        const blockers = parseConflictBlockers(err);
        if (blockers.length > 0) {
          setConflictBlockers(blockers);
        }
        void readinessQ.refetch();
        return;
      }
      toast.error(err.message || "Could not complete Batch Request.");
      void readinessQ.refetch();
    },
  });

  if (requestCompletedAt) return null;

  const readiness = readinessQ.data;
  const ready = readiness?.ready ?? false;
  const blockerSummary = summarizeBlockers(readiness);
  const dialogBlockers = conflictBlockers ?? (ready ? null : readiness?.blockers ?? null);

  function openReview() {
    setDialogOpen(false);
    setReviewOpen(true);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!ready || completeM.isPending}
        onClick={() => {
          setConflictBlockers(null);
          setDialogOpen(true);
        }}
      >
        Complete Request
      </Button>
      {!ready && blockerSummary ? (
        <p className="text-sm text-muted-foreground">{blockerSummary}</p>
      ) : displayReady && !ready && readinessQ.isFetching ? (
        <p className="text-sm text-muted-foreground">Checking readiness…</p>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setConflictBlockers(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Batch Request</DialogTitle>
            <DialogDescription>
              Completing this request will send the final Batch confirmation to{" "}
              {readiness?.primaryContactEmail ?? "the Centre primary contact"}.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground">
            {readiness?.activeShiftCount ?? 0} active shift assignment
            {(readiness?.activeShiftCount ?? 0) === 1 ? "" : "s"} will be included in the final
            confirmation.
          </p>
          {dialogBlockers && dialogBlockers.length > 0 ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <p className="font-medium">This Batch Request is no longer ready:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {dialogBlockers.slice(0, 4).map((blocker) => (
                  <li key={`${blocker.code}-${blocker.shiftId ?? blocker.message}`}>
                    {blocker.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ready || completeM.isPending || Boolean(dialogBlockers?.length)}
              onClick={openReview}
            >
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
        submitting={completeM.isPending}
        submitLabel="Complete Request & send confirmation"
        staleError={centreReview.staleError}
        onBack={() => {
          setReviewOpen(false);
          setDialogOpen(true);
        }}
        onSubmit={() => completeM.mutate(centreReview.centreEmailPayload)}
      />
    </div>
  );
}

function parseConflictBlockers(err: ApiError): BatchCompletionReadiness["blockers"] {
  const raw = err.details?.blockers;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is BatchCompletionReadiness["blockers"][number] =>
      Boolean(item && typeof item === "object" && "message" in item),
  );
}

function summarizeBlockers(readiness: BatchCompletionReadiness | undefined) {
  if (!readiness || readiness.ready) return null;
  if (readiness.blockers.length === 0) return null;
  const unfilled = readiness.blockers.filter((b) => b.code === "unfilled_shift").length;
  if (unfilled > 0) {
    return `${unfilled} active shift${unfilled === 1 ? "" : "s"} ${unfilled === 1 ? "is" : "are"} still unfilled.`;
  }
  return readiness.blockers[0]?.message ?? "Batch is not ready to complete.";
}
