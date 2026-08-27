export type AssigneeImpactStatus = "eligible" | "availability_override_available" | "must_unassign";

export type ShiftAssignmentResolution = "unassign" | "availability_override";

export type AssigneeImpactPreview = {
  status: AssigneeImpactStatus;
  staffId: string;
  staffName: string;
  reasons: string[];
  reasonMessages: string[];
};

export type ShiftUpdatePreviewResponse = {
  relevantChanges: Array<{
    field: "date" | "time" | "role";
    label: string;
    beforeDisplay: string;
    afterDisplay: string;
  }>;
  assigneeImpact: AssigneeImpactPreview | null;
  requiresAssignmentResolution: boolean;
};

export function hasScheduleEditChange(
  before: { shiftDate: string; startTime: string; endTime: string },
  edit: { shiftDate: string; startTime: string; endTime: string },
): boolean {
  return (
    before.shiftDate !== edit.shiftDate ||
    before.startTime.slice(0, 5) !== edit.startTime ||
    before.endTime.slice(0, 5) !== edit.endTime
  );
}

export function hasAssigneeRevalidationEditChange(
  before: { shiftDate: string; startTime: string; endTime: string; roleNeeded: string },
  edit: { shiftDate: string; startTime: string; endTime: string; roleNeeded: string },
): boolean {
  return hasScheduleEditChange(before, edit) || before.roleNeeded !== edit.roleNeeded;
}

export function formatAssigneeImpactScheduleLine(preview: ShiftUpdatePreviewResponse): string | null {
  const dateChange = preview.relevantChanges.find((c) => c.field === "date");
  const timeChange = preview.relevantChanges.find((c) => c.field === "time");
  if (dateChange && timeChange) {
    return `${dateChange.afterDisplay} from ${timeChange.afterDisplay}`;
  }
  if (dateChange) return dateChange.afterDisplay;
  if (timeChange) return timeChange.afterDisplay;
  return null;
}
