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
import { normalizeCancellationReason } from "@/lib/shifts-lifecycle-ui";
import {
  ShiftRecipientCheckboxes,
  hasSelectedRecipient,
  type ShiftRecipientAvailability,
} from "@/components/shifts/ShiftRecipientCheckboxes";

type Step = "reason" | "communications";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centreAvailability: ShiftRecipientAvailability;
  carerAvailability: ShiftRecipientAvailability;
  submitting: boolean;
  onConfirm: (input: {
    reason: string;
    communications?: { centre: boolean; carer: boolean };
  }) => void;
};

export function ShiftCancelDialog({
  open,
  onOpenChange,
  centreAvailability,
  carerAvailability,
  submitting,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState("");
  const [sendCommunication, setSendCommunication] = useState(false);
  const [centreSelected, setCentreSelected] = useState(false);
  const [carerSelected, setCarerSelected] = useState(false);

  const normalizedReason = normalizeCancellationReason(reason);

  useEffect(() => {
    if (!open) {
      setStep("reason");
      setReason("");
      setSendCommunication(false);
      setCentreSelected(false);
      setCarerSelected(false);
      return;
    }
    setCentreSelected(centreAvailability.available);
    setCarerSelected(carerAvailability.available);
  }, [open, centreAvailability.available, carerAvailability.available]);

  function handleOpenChange(next: boolean) {
    if (submitting) return;
    onOpenChange(next);
  }

  function submitWithoutCommunication() {
    if (!normalizedReason) return;
    onConfirm({ reason: normalizedReason });
  }

  function submitWithCommunication() {
    if (!normalizedReason || !hasSelectedRecipient(centreSelected, carerSelected)) return;
    onConfirm({
      reason: normalizedReason,
      communications: { centre: centreSelected, carer: carerSelected },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancel this shift?</DialogTitle>
          <DialogDescription>
            The shift stays on record as Cancelled. A reason is required for internal records.
          </DialogDescription>
        </DialogHeader>

        {step === "reason" ? (
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Cancellation reason *</Label>
            <Textarea
              id="cancel-reason"
              required
              placeholder="Why is this shift being cancelled?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={reason.length > 0 && !normalizedReason}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-foreground">Send cancellation communication?</p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cancel-comm-choice"
                  checked={!sendCommunication}
                  disabled={submitting}
                  onChange={() => setSendCommunication(false)}
                />
                No communication
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="cancel-comm-choice"
                  checked={sendCommunication}
                  disabled={submitting}
                  onChange={() => setSendCommunication(true)}
                />
                Send communication
              </label>
            </div>
            {sendCommunication && (
              <ShiftRecipientCheckboxes
                centreAvailability={centreAvailability}
                carerAvailability={carerAvailability}
                centreSelected={centreSelected}
                carerSelected={carerSelected}
                onCentreSelectedChange={setCentreSelected}
                onCarerSelectedChange={setCarerSelected}
                disabled={submitting}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "reason" ? (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
                Keep shift
              </Button>
              <Button
                disabled={!normalizedReason || submitting}
                onClick={() => setStep("communications")}
              >
                Continue
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => setStep("reason")}>
                Back
              </Button>
              <Button
                disabled={
                  submitting ||
                  (sendCommunication && !hasSelectedRecipient(centreSelected, carerSelected))
                }
                onClick={() =>
                  sendCommunication ? submitWithCommunication() : submitWithoutCommunication()
                }
              >
                {submitting ? "Cancelling…" : "Cancel shift"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
