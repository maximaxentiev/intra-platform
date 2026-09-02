import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShiftRecipientCheckboxes,
  hasSelectedRecipient,
} from "@/components/shifts/ShiftRecipientCheckboxes";
import type { BatchCancelCase } from "@/lib/batch-shift-ui";
import { buildBatchCancelConfirmPayload } from "@/lib/batch-shift-ui";
import { normalizeCancellationReason } from "@/lib/shifts-lifecycle-ui";

type Step = "reason" | "communications";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancelCase: BatchCancelCase;
  assignedCarerSummaries: Array<{ staffId: string; name: string; shiftCount: number }>;
  submitting: boolean;
  onConfirm: (input: {
    reason: string;
    communications?: { centre: boolean; carer: boolean };
  }) => void;
};

export function BatchCancelBatchDialog({
  open,
  onOpenChange,
  cancelCase,
  assignedCarerSummaries,
  submitting,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [sendCommunication, setSendCommunication] = useState(cancelCase !== "A");
  const [centreSelected, setCentreSelected] = useState(false);
  const [carerSelected, setCarerSelected] = useState(cancelCase === "B");

  const normalizedReason = normalizeCancellationReason(reason);
  const centreAvailable = cancelCase === "C";
  const carerAvailable = cancelCase === "B" || cancelCase === "C";

  useEffect(() => {
    if (!open) {
      setStep("reason");
      setReason("");
      setSendCommunication(cancelCase !== "A");
      setCentreSelected(false);
      setCarerSelected(cancelCase === "B");
      return;
    }
    setSendCommunication(cancelCase !== "A");
    setCentreSelected(false);
    setCarerSelected(cancelCase === "B");
  }, [open, cancelCase]);

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    onOpenChange(next);
  }

  function submitCancellation() {
    if (!normalizedReason) return;
    onConfirm(
      buildBatchCancelConfirmPayload({
        reason: normalizedReason,
        cancelCase,
        sendCommunication,
        centreSelected,
        carerSelected,
      }),
    );
  }

  const activeStep: Step = cancelCase === "A" ? "reason" : step;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel this Batch Request?</DialogTitle>
          <DialogDescription>
            All remaining active shifts in this batch will be cancelled. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        {activeStep === "reason" ? (
          <div className="space-y-4">
            {cancelCase === "B" && assignedCarerSummaries.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">Assigned carers affected</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {assignedCarerSummaries.map((carer) => (
                    <li key={carer.staffId}>
                      {carer.name} · {carer.shiftCount} shift{carer.shiftCount === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="batch-cancel-reason">Cancellation reason *</Label>
              <Textarea
                id="batch-cancel-reason"
                required
                placeholder="Why is this batch being cancelled?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-invalid={reason.length > 0 && !normalizedReason}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-foreground">Send cancellation communication?</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="batch-cancel-comm-choice"
                  checked={!sendCommunication}
                  disabled={submitting}
                  onChange={() => setSendCommunication(false)}
                />
                No communication
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="batch-cancel-comm-choice"
                  checked={sendCommunication}
                  disabled={submitting}
                  onChange={() => setSendCommunication(true)}
                />
                {cancelCase === "B" ? "Email assigned Carers about the cancellation" : "Send communication"}
              </label>
            </div>
            {sendCommunication && cancelCase === "C" ? (
              <ShiftRecipientCheckboxes
                centreAvailability={{ available: centreAvailable }}
                carerAvailability={{
                  available: carerAvailable,
                  reason: assignedCarerSummaries.length ? undefined : "No assigned carers.",
                }}
                centreSelected={centreSelected}
                carerSelected={carerSelected}
                onCentreSelectedChange={setCentreSelected}
                onCarerSelectedChange={setCarerSelected}
                disabled={submitting}
              />
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {activeStep === "reason" ? (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
                Keep batch
              </Button>
              {cancelCase === "A" ? (
                <Button
                  variant="destructive"
                  disabled={!normalizedReason || submitting}
                  onClick={submitCancellation}
                >
                  {submitting ? "Cancelling…" : "Cancel batch"}
                </Button>
              ) : (
                <Button disabled={!normalizedReason || submitting} onClick={() => setStep("communications")}>
                  Continue
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => setStep("reason")}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={
                  submitting ||
                  (sendCommunication &&
                    cancelCase === "C" &&
                    !hasSelectedRecipient(centreSelected, carerSelected))
                }
                onClick={() => {
                  if (sendCommunication && cancelCase === "C" && !hasSelectedRecipient(centreSelected, carerSelected)) {
                    return;
                  }
                  submitCancellation();
                }}
              >
                {submitting ? "Cancelling…" : "Cancel batch"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
