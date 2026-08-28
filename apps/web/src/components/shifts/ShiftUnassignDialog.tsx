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
  carerName: string;
  centreName: string;
  shiftDate: string;
  centreAvailability: ShiftRecipientAvailability;
  carerAvailability: ShiftRecipientAvailability;
  submitting: boolean;
  onConfirmWithoutEmail: () => void;
  onConfirmWithRecipients: (recipients: { centre: boolean; carer: boolean }) => void;
};

export function ShiftUnassignDialog({
  open,
  onOpenChange,
  carerName,
  centreName,
  shiftDate,
  centreAvailability,
  carerAvailability,
  submitting,
  onConfirmWithoutEmail,
  onConfirmWithRecipients,
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
          <DialogTitle>Unassign Carer</DialogTitle>
          <DialogDescription>
            Remove <span className="font-medium text-foreground">{carerName}</span> from the Shift
            at <span className="font-medium text-foreground">{centreName}</span> on{" "}
            <span className="font-medium text-foreground">{shiftDate}</span>.
          </DialogDescription>
        </DialogHeader>

        {step === "prompt" ? (
          <p className="text-sm text-foreground">
            Send communication about this unassignment?
          </p>
        ) : (
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
              <Button variant="outline" disabled={submitting} onClick={onConfirmWithoutEmail}>
                Save without email
              </Button>
              <Button disabled={submitting} onClick={() => setStep("recipients")}>
                Send communication
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
                  onConfirmWithRecipients({ centre: centreSelected, carer: carerSelected })
                }
              >
                {submitting ? "Unassigning…" : "Confirm unassign"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
