import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import type { BatchCompletionReadiness } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";

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

  const readinessQ = useQuery({
    queryKey: ["shift-batch-completion-readiness", batchId],
    queryFn: () => shiftBatchesApi.getCompletionReadiness(batchId),
    enabled: !requestCompletedAt,
  });

  const completeM = useMutation({
    mutationFn: () => shiftBatchesApi.completeRequest(batchId),
    onSuccess: () => {
      toast.success("Batch Request completed.");
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
      void qc.invalidateQueries({ queryKey: ["shift-batch-completion-readiness", batchId] });
      void qc.invalidateQueries({ queryKey: ["shifts-feed"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not complete Batch Request.");
      void readinessQ.refetch();
    },
  });

  if (requestCompletedAt) return null;

  const readiness = readinessQ.data;
  const ready = readiness?.ready ?? false;
  const blockerSummary = summarizeBlockers(readiness);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!ready || completeM.isPending}
        onClick={() => setDialogOpen(true)}
      >
        Complete Request
      </Button>
      {!ready && blockerSummary ? (
        <p className="text-sm text-muted-foreground">{blockerSummary}</p>
      ) : displayReady && !ready && readinessQ.isFetching ? (
        <p className="text-sm text-muted-foreground">Checking readiness…</p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!ready || completeM.isPending}
              onClick={() => completeM.mutate()}
            >
              {completeM.isPending ? "Completing…" : "Complete Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
