import { Checkbox } from "@/components/ui/checkbox";
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
import { PropertyList } from "@/components/ui-kit";
import type { ShiftAssignmentConfirmDetails } from "@/lib/shift-assignment-confirm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: ShiftAssignmentConfirmDetails | null;
  reassignment?: { currentCarerName: string } | null;
  notifyPreviousCarer: boolean;
  onNotifyPreviousCarerChange: (checked: boolean) => void;
  confirming: boolean;
  onConfirm: () => void;
  /** When Centre confirmation is deferred to an open Batch Request. */
  batchCentreDeferred?: boolean;
};

export function ShiftAssignmentConfirmDialog({
  open,
  onOpenChange,
  details,
  reassignment,
  notifyPreviousCarer,
  onNotifyPreviousCarerChange,
  confirming,
  onConfirm,
  batchCentreDeferred = false,
}: Props) {
  const isReassignment = reassignment != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirming) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isReassignment ? "Replace assigned Carer?" : "Confirm Staff assignment"}
          </DialogTitle>
          <DialogDescription>
            {isReassignment ? (
              <>
                Assigning {details?.staffLegalName ?? "this Staff member"} will remove{" "}
                {reassignment.currentCarerName} from this Shift.
                {batchCentreDeferred
                  ? " The new Carer will receive a confirmation. Centre confirmation remains deferred through the Batch Request."
                  : " The new Carer will receive the normal assignment confirmation."}
              </>
            ) : batchCentreDeferred ? (
              <>
                Confirming will assign this Staff member to the Shift. The Carer will receive a
                confirmation. Centre confirmation will be sent through the Batch Request.
              </>
            ) : (
              <>
                Confirming will assign this Staff member to the Shift and send the existing
                assignment confirmation communications.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {details ? (
          <PropertyList
            columns={1}
            items={[
              ...(isReassignment
                ? [{ label: "Current Carer", value: reassignment.currentCarerName }]
                : []),
              { label: isReassignment ? "New Carer" : "Staff", value: details.staffLegalName },
              { label: "Centre", value: details.centreName },
              { label: "Date", value: details.dateLabel },
              { label: "Time", value: details.timeLabel },
              { label: "Role required", value: details.roleLabel },
            ]}
          />
        ) : null}

        {isReassignment ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-3">
            <Checkbox
              checked={notifyPreviousCarer}
              onCheckedChange={(checked) => onNotifyPreviousCarerChange(checked === true)}
              aria-describedby="notify-previous-carer-desc"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">
                Email the previous Carer to confirm they have been unassigned
              </span>
              <span id="notify-previous-carer-desc" className="block text-xs text-muted-foreground">
                Uses the standard unassignment email for the Shift they are being removed from.
              </span>
            </span>
          </label>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={confirming || !details} onClick={onConfirm}>
            {confirming
              ? isReassignment
                ? "Replacing Carer…"
                : "Confirming assignment…"
              : isReassignment
                ? "Replace Carer"
                : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
