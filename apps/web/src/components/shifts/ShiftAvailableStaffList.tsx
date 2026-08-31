import { Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui-kit";
import { displayStaff, type AvailableStaff } from "@/lib/db";
import {
  formatAvailableStaffPriorityLine,
  isAvailableStaffPriorityBoundary,
} from "@/lib/shift-matching-priority-ui";

type Props = {
  candidates: AvailableStaff[];
  assignedStaffId: string | null;
  assignedName: string | null;
  assignDisabled: boolean;
  onToggleContacted: (staffId: string, currentlyContacted: boolean) => void;
  onAssign: (staff: AvailableStaff) => void;
};

export function ShiftAvailableStaffList({
  candidates,
  assignedStaffId,
  assignedName,
  assignDisabled,
  onToggleContacted,
  onAssign,
}: Props) {
  const otherCandidates = candidates.filter((s) => s.id !== assignedStaffId);

  if (otherCandidates.length === 0) {
    return (
      <EmptyState
        title={assignedName ? "No other eligible staff" : "No eligible staff found for this shift."}
        description={
          assignedName
            ? "Nobody else currently satisfies all assignment requirements."
            : "Availability, scheduling conflicts, centre restrictions, account status, role, and document compliance are considered automatically."
        }
        action={
          !assignedName ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/availability">Team availability</Link>
            </Button>
          ) : undefined
        }
        className="px-4 py-3.5 text-left"
      />
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {otherCandidates.map((s, index) => {
        const previous = index > 0 ? otherCandidates[index - 1] : undefined;
        const showPriorityBoundary = isAvailableStaffPriorityBoundary(previous, s);
        const staffName = displayStaff(s);

        return (
          <li
            key={s.id}
            className={`transition-colors hover:bg-muted/40 motion-reduce:transition-none${showPriorityBoundary ? " border-t border-border/80" : ""}`}
          >
            <div className="hidden items-center gap-4 px-4 py-2.5 md:grid md:grid-cols-[minmax(8rem,1.05fr)_minmax(0,2.5fr)_5rem_auto_auto]">
              <p className="truncate text-sm font-medium text-foreground">{staffName}</p>
              <p className="min-w-0 text-[13px] text-muted-foreground">
                {formatAvailableStaffPriorityLine(s)}
              </p>
              <p className="text-[13px] text-muted-foreground">{s.role || "No role"}</p>
              <label className="flex cursor-pointer select-none items-center gap-2 text-[13px]">
                <Checkbox
                  checked={s.contacted}
                  onCheckedChange={() => onToggleContacted(s.id, s.contacted)}
                  aria-label={`Mark ${staffName} as contacted`}
                />
                Contacted
              </label>
              <Button
                size="sm"
                className="justify-self-end"
                disabled={assignDisabled}
                onClick={() => onAssign(s)}
                aria-label={`Assign ${staffName} to this shift`}
              >
                Assign
              </Button>
            </div>

            <div className="space-y-3 px-4 py-3 md:hidden">
              <p className="text-sm font-medium text-foreground">{staffName}</p>
              <p className="text-[13px] text-muted-foreground">
                {formatAvailableStaffPriorityLine(s)}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted-foreground">{s.role || "No role"}</p>
                <label className="flex cursor-pointer select-none items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={s.contacted}
                    onCheckedChange={() => onToggleContacted(s.id, s.contacted)}
                    aria-label={`Mark ${staffName} as contacted`}
                  />
                  Contacted
                </label>
              </div>
              <Button
                size="sm"
                className="w-full sm:w-auto"
                disabled={assignDisabled}
                onClick={() => onAssign(s)}
                aria-label={`Assign ${staffName} to this shift`}
              >
                Assign
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ShiftAssignedCarerBar({
  assignedName,
  resendDisabled,
  unassignDisabled,
  onResend,
  onUnassign,
}: {
  assignedName: string;
  resendDisabled: boolean;
  unassignDisabled: boolean;
  onResend: () => void;
  onUnassign: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-success-soft/60 px-4 py-3">
      <UserCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned Carer
        </p>
        <p className="text-sm font-semibold text-foreground">{assignedName}</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={resendDisabled}
          onClick={onResend}
        >
          Resend confirmation
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={unassignDisabled}
          onClick={onUnassign}
        >
          Unassign
        </Button>
      </div>
    </div>
  );
}
