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
import {
  ShiftRecipientCheckboxes,
  hasSelectedRecipient,
  type ShiftRecipientAvailability,
} from "@/components/shifts/ShiftRecipientCheckboxes";

type Step = "prompt" | "recipients";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centreAvailability: ShiftRecipientAvailability;
  carerAvailability: ShiftRecipientAvailability;
  submitting: boolean;
  onConfirmSend: (recipients: { centre: boolean; carer: boolean }) => void;
};

export function ShiftResendConfirmationDialog({
  open,
  onOpenChange,
  centreAvailability,
  carerAvailability,
  submitting,
  onConfirmSend,
}: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [centreSelected, setCentreSelected] = useState(false);
  const [carerSelected, setCarerSelected] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("prompt");
      setCentreSelected(false);
      setCarerSelected(false);
      return;
    }
    setCentreSelected(centreAvailability.available);
    setCarerSelected(carerAvailability.available);
  }, [open, centreAvailability.available, carerAvailability.available]);

  const canSubmitRecipients =
    hasSelectedRecipient(centreSelected, carerSelected) && !submitting;

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resend confirmation</DialogTitle>
          <DialogDescription>
            {step === "prompt"
              ? "Send confirmation communication?"
              : "Select who should receive the assignment confirmation."}
          </DialogDescription>
        </DialogHeader>

        {step === "recipients" && (
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

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "prompt" ? (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
                No / Cancel
              </Button>
              <Button disabled={submitting} onClick={() => setStep("recipients")}>
                Yes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={submitting} onClick={() => setStep("prompt")}>
                Back
              </Button>
              <Button
                disabled={!canSubmitRecipients}
                onClick={() =>
                  onConfirmSend({ centre: centreSelected, carer: carerSelected })
                }
              >
                {submitting ? "Sending…" : "Resend confirmation"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
