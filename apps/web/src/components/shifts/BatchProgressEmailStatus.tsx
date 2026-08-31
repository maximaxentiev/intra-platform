import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BatchProgressEmailStatus } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";

export function BatchProgressEmailStatus({
  batchId,
  status,
}: {
  batchId: string;
  status: BatchProgressEmailStatus;
}) {
  const qc = useQueryClient();
  const retryM = useMutation({
    mutationFn: () => shiftBatchesApi.retryProgressEmail(batchId),
    onSuccess: () => {
      toast.success("Progress update scheduled.");
      void qc.invalidateQueries({ queryKey: ["shift-batch", batchId] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Could not schedule progress update.");
    },
  });

  if (status.state === "none") return null;

  if (status.state === "scheduled") {
    return (
      <p className="text-sm text-muted-foreground">Centre progress update scheduled</p>
    );
  }

  if (status.state === "sending") {
    return <p className="text-sm text-muted-foreground">Centre progress update sending…</p>;
  }

  if (status.state === "sent") {
    return <p className="text-sm text-muted-foreground">Centre progress update sent</p>;
  }

  if (status.state === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-destructive">
          Centre progress update could not be sent
          {status.reason ? `: ${status.reason}` : ""}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={retryM.isPending}
          onClick={() => retryM.mutate()}
        >
          Retry progress email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm text-destructive">
        Centre progress update could not be sent: {status.reason}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={retryM.isPending}
        onClick={() => retryM.mutate()}
      >
        Retry progress email
      </Button>
    </div>
  );
}
