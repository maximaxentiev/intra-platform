import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  defaultIncludeForChanges,
  formatShiftChangeArrow,
  type ShiftCommunicationChange,
  type ShiftCommunicationField,
  type ShiftUpdateCommunicationsPayload,
} from "@/lib/shift-edit-communications";

type RecipientAvailability = {
  available: boolean;
  reason?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  changes: ShiftCommunicationChange[];
  centreAvailability: RecipientAvailability;
  carerAvailability: RecipientAvailability;
  assignmentUnassigned?: boolean;
  saving: boolean;
  onSaveWithoutEmail: () => void;
  onSaveWithCommunications: (communications: ShiftUpdateCommunicationsPayload) => void;
};

type Step = "prompt" | "configure";

export function ShiftEditCommunicationsDialog({
  open,
  onOpenChange,
  changes,
  centreAvailability,
  carerAvailability,
  assignmentUnassigned = false,
  saving,
  onSaveWithoutEmail,
  onSaveWithCommunications,
}: Props) {
  const [step, setStep] = useState<Step>("prompt");
  const [centreSelected, setCentreSelected] = useState(false);
  const [carerSelected, setCarerSelected] = useState(false);
  const [centreInclude, setCentreInclude] = useState<Partial<Record<ShiftCommunicationField, boolean>>>({});
  const [carerInclude, setCarerInclude] = useState<Partial<Record<ShiftCommunicationField, boolean>>>({});

  useEffect(() => {
    if (!open) {
      setStep("prompt");
      setCentreSelected(false);
      setCarerSelected(false);
      setCentreInclude({});
      setCarerInclude({});
      return;
    }
    const defaults = defaultIncludeForChanges(changes);
    setCentreInclude(defaults);
    setCarerInclude(defaults);
    setCentreSelected(centreAvailability.available);
    setCarerSelected(carerAvailability.available);
  }, [open, changes, centreAvailability.available, carerAvailability.available]);

  const centreFields = useMemo(
    () => changes.filter((change) => centreSelected && change.field),
    [changes, centreSelected],
  );
  const carerFields = useMemo(
    () => changes.filter((change) => carerSelected && change.field),
    [changes, carerSelected],
  );

  const centreHasSelection =
    !centreSelected ||
    assignmentUnassigned ||
    changes.some((change) => centreInclude[change.field]);
  const carerHasSelection =
    !carerSelected ||
    assignmentUnassigned ||
    changes.some((change) => carerInclude[change.field]);
  const recipientSelected = centreSelected || carerSelected;
  const canSubmit =
    recipientSelected && centreHasSelection && carerHasSelection && !saving;

  const submitLabel = useMemo(() => {
    const count = Number(centreSelected) + Number(carerSelected);
    return count > 1 ? "Save changes & send emails" : "Save changes & send email";
  }, [centreSelected, carerSelected]);

  function toggleInclude(
    recipient: "centre" | "carer",
    field: ShiftCommunicationField,
    checked: boolean,
  ) {
    const setter = recipient === "centre" ? setCentreInclude : setCarerInclude;
    setter((prev) => ({ ...prev, [field]: checked }));
  }

  function handleFinalSubmit() {
    const payload: ShiftUpdateCommunicationsPayload = {};
    if (centreSelected) {
      payload.centre = { send: true, include: centreInclude };
    }
    if (carerSelected) {
      payload.carer = { send: true, include: carerInclude };
    }
    onSaveWithCommunications(payload);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Save Shift changes</DialogTitle>
          <DialogDescription>
            Review what changed before saving this Shift.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-muted/30 p-4 space-y-3">
            {changes.map((change) => (
              <div key={change.field}>
                <p className="text-sm font-medium text-foreground">{change.label}</p>
                <p className="text-sm text-muted-foreground">{formatShiftChangeArrow(change)}</p>
              </div>
            ))}
          </div>

          {assignmentUnassigned && (
            <p className="text-sm text-muted-foreground">
              The assigned Staff member will be removed. You can still notify the Centre and Carer about
              the schedule change and assignment impact.
            </p>
          )}

          {step === "prompt" ? (
            <p className="text-sm text-foreground">Notify the Centre or Carer about these changes?</p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Choose recipients</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={centreSelected}
                      disabled={!centreAvailability.available || saving}
                      onCheckedChange={(checked) => setCentreSelected(checked === true)}
                    />
                    <span>
                      <span className="font-medium">Centre</span>
                      {!centreAvailability.available && (
                        <span className="block text-muted-foreground">
                          {centreAvailability.reason ?? "No valid Centre email configured."}
                        </span>
                      )}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={carerSelected}
                      disabled={!carerAvailability.available || saving}
                      onCheckedChange={(checked) => setCarerSelected(checked === true)}
                    />
                    <span>
                      <span className="font-medium">Carer</span>
                      {!carerAvailability.available && (
                        <span className="block text-muted-foreground">
                          {carerAvailability.reason ?? "No Carer assigned."}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              {(centreSelected || carerSelected) && (
                <div className="grid gap-4 md:grid-cols-2">
                  {centreSelected && (
                    <RecipientPanel
                      title="Centre communication"
                      changes={centreFields}
                      include={centreInclude}
                      disabled={saving}
                      onToggle={(field, checked) => toggleInclude("centre", field, checked)}
                    />
                  )}
                  {carerSelected && (
                    <RecipientPanel
                      title="Carer communication"
                      changes={carerFields}
                      include={carerInclude}
                      disabled={saving}
                      onToggle={(field, checked) => toggleInclude("carer", field, checked)}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "prompt" ? (
            <>
              <Button variant="outline" disabled={saving} onClick={onSaveWithoutEmail}>
                Save without email
              </Button>
              <Button disabled={saving} onClick={() => setStep("configure")}>
                Choose communications
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setStep("prompt")}>
                Back
              </Button>
              <Button disabled={!canSubmit} onClick={handleFinalSubmit}>
                {submitLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecipientPanel({
  title,
  changes,
  include,
  disabled,
  onToggle,
}: {
  title: string;
  changes: ShiftCommunicationChange[];
  include: Partial<Record<ShiftCommunicationField, boolean>>;
  disabled: boolean;
  onToggle: (field: ShiftCommunicationField, checked: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-border/70 p-4 space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.field} className="flex items-center gap-2">
            <Checkbox
              id={`${title}-${change.field}`}
              checked={!!include[change.field]}
              disabled={disabled}
              onCheckedChange={(checked) => onToggle(change.field, checked === true)}
            />
            <Label htmlFor={`${title}-${change.field}`} className="text-sm font-normal">
              {change.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
