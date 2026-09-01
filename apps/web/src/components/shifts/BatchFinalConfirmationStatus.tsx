import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BatchFinalConfirmationStatus } from "@/lib/db";
import { shiftBatchesApi } from "@/lib/db";
import { cn } from "@/lib/utils";

export function BatchFinalConfirmationStatus({
  batchId,
  status,
  requestCompletedAt,
  tone = "default",
}: {
  batchId: string;
  status: BatchFinalConfirmationStatus;
  requestCompletedAt: string | null;
  tone?: "default" | "onDark";
}) {
  const qc = useQueryClient();
  const onDark = tone === "onDark";
  const mutedClass = onDark ? "text-white/90" : "text-muted-foreground";
  const destructiveClass = onDark ? "text-red-200" : "text-destructive";

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
    return <p className={cn("text-sm", mutedClass)}>Final Centre confirmation scheduled</p>;
  }

  if (status.state === "sending") {
    return <p className={cn("text-sm", mutedClass)}>Final Centre confirmation sending…</p>;
  }

  if (status.state === "sent") {
    return <p className={cn("text-sm", mutedClass)}>Final Centre confirmation sent</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className={cn("text-sm", destructiveClass)}>
        Final Centre confirmation could not be sent
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
        Retry Centre confirmation
      </Button>
    </div>
  );
}
