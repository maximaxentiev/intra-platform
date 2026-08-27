import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AssigneeImpactPreview } from "@/lib/shift-assignee-impact";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  impact: AssigneeImpactPreview;
  scheduleSummary: string | null;
  onUnassign: () => void;
  onOverride: () => void;
  onGoBack: () => void;
};

export function ShiftAssigneeImpactDialog({
  open,
  onOpenChange,
  impact,
  scheduleSummary,
  onUnassign,
  onOverride,
  onGoBack,
}: Props) {
  const availabilityOnly = impact.status === "availability_override_available";
  const title = availabilityOnly
    ? "Assigned Staff is unavailable for the revised schedule"
    : "Assigned Staff cannot remain on the revised Shift";
  const description = availabilityOnly
    ? scheduleSummary
      ? `${impact.staffName} is currently assigned to this Shift, but their submitted availability does not cover ${scheduleSummary}.`
      : `${impact.staffName} is currently assigned to this Shift, but their submitted availability does not cover the revised schedule.`
    : `${impact.staffName} is currently assigned to this Shift, but they cannot remain assigned for the revised schedule.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!availabilityOnly && impact.reasonMessages.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {impact.reasonMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Change schedule & unassign Staff</p>
            <p>The Shift will return to Pending and matching will use the revised schedule.</p>
          </div>
          {availabilityOnly && (
            <div>
              <p className="font-medium text-foreground">Keep Staff assigned — availability confirmed</p>
              <p>
                Use this only if you have confirmed directly that the Staff member can work the
                revised schedule.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button onClick={onUnassign}>Change schedule & unassign Staff</Button>
          {availabilityOnly && (
            <Button variant="outline" onClick={onOverride}>
              Keep Staff assigned — availability confirmed
            </Button>
          )}
          <Button variant="ghost" onClick={onGoBack}>
            Go back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
