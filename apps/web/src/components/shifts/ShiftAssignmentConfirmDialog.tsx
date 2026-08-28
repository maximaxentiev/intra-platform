import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PropertyList } from "@/components/ui-kit";
import type { ShiftAssignmentConfirmDetails } from "@/lib/shift-assignment-confirm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: ShiftAssignmentConfirmDetails | null;
  confirming: boolean;
  onConfirm: () => void;
};

export function ShiftAssignmentConfirmDialog({
  open,
  onOpenChange,
  details,
  confirming,
  onConfirm,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!confirming) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Staff assignment</DialogTitle>
          <DialogDescription>
            Confirming will assign this Staff member to the Shift and send the existing assignment
            confirmation communications.
          </DialogDescription>
        </DialogHeader>

        {details ? (
          <PropertyList
            columns={1}
            items={[
              { label: "Staff", value: details.staffLegalName },
              { label: "Centre", value: details.centreName },
              { label: "Date", value: details.dateLabel },
              { label: "Time", value: details.timeLabel },
              { label: "Role required", value: details.roleLabel },
            ]}
          />
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
            {confirming ? "Confirming assignment…" : "Confirm assignment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
