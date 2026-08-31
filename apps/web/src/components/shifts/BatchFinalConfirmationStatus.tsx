import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BatchFinalConfirmationStatus } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";

export function BatchFinalConfirmationStatus({
  batchId,
  status,
  requestCompletedAt,
}: {
  batchId: string;
  status: BatchFinalConfirmationStatus;
  requestCompletedAt: string | null;
}) {
  const qc = useQueryClient();
  const retryM = useMutation({
    mutationFn: () => shiftBatchesApi.retryFinalConfirmation(batchId),
    onSuccess: () => {
      toast.success("Final Centre confirmation scheduled.");
      void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not schedule final confirmation.");
    },
  });

  if (!requestCompletedAt) return null;
  if (status.state === "none") return null;

  if (status.state === "scheduled") {
    return <p className="text-sm text-muted-foreground">Final Centre confirmation scheduled</p>;
  }

  if (status.state === "sending") {
    return <p className="text-sm text-muted-foreground">Final Centre confirmation sending…</p>;
  }

  if (status.state === "sent") {
    return <p className="text-sm text-muted-foreground">Final Centre confirmation sent</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-destructive">
        Final Centre confirmation could not be sent
        {status.reason ? `: ${status.reason}` : ""}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={retryM.isPending}
        onClick={() => retryM.mutate()}
      >
        Retry Centre confirmation
      </Button>
    </div>
  );
}
