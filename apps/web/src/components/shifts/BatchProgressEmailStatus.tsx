import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BatchProgressEmailStatus } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";

export function BatchProgressEmailStatus({
  batchId,
  status,
  requestCompletedAt,
  tone = "default",
}: {
  batchId: string;
  status: BatchProgressEmailStatus;
  requestCompletedAt?: string | null;
  tone?: "default" | "onDark";
}) {
  const qc = useQueryClient();
  const onDark = tone === "onDark";
  const mutedClass = onDark ? "text-white/90" : "text-muted-foreground";
  const destructiveClass = onDark ? "text-red-200" : "text-destructive";
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

  if (status.state === "none" || requestCompletedAt) return null;

  if (status.state === "scheduled") {
    return (
      <p className={`text-sm ${mutedClass}`}>Centre progress update scheduled</p>
    );
  }

  if (status.state === "sending") {
    return <p className={`text-sm ${mutedClass}`}>Centre progress update sending…</p>;
  }

  if (status.state === "sent") {
    return <p className={`text-sm ${mutedClass}`}>Centre progress update sent</p>;
  }

  if (status.state === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className={`text-sm ${destructiveClass}`}>
          Centre progress update could not be sent
          {status.reason ? `: ${status.reason}` : ""}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={onDark ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : undefined}
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
      <p className={`text-sm ${destructiveClass}`}>
        Centre progress update could not be sent: {status.reason}
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={onDark ? "border-white/30 bg-white/10 text-white hover:bg-white/20" : undefined}
        disabled={retryM.isPending}
        onClick={() => retryM.mutate()}
      >
        Retry progress email
      </Button>
    </div>
  );
}
