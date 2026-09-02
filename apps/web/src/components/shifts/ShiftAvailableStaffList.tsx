import { Link } from "@tanstack/react-router";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui-kit";
import { displayStaff, type AvailableStaff } from "@/lib/db";
import {
  formatAvailableStaffPriorityChips,
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
  const isReplacement = assignedStaffId != null;

  if (otherCandidates.length === 0) {
    return (
      <EmptyState
        title={assignedName ? "No other eligible staff" : "No eligible staff found for this shift."}
        description={
          assignedName
            ? "Nobody else currently satisfies all assignment requirements."
            : "Availability, scheduling conflicts, centre restrictions, account status, role, and document compliance are considered automatically."
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
        const priorityChips = formatAvailableStaffPriorityChips(s);
        const rowAssignDisabled = assignDisabled || !s.contacted;

        return (
          <li
            key={s.id}
            className={`transition-colors hover:bg-muted/40 motion-reduce:transition-none${showPriorityBoundary ? " border-t border-border/80" : ""}`}
          >
            <div className="hidden items-center gap-3 px-4 py-2.5 xl:grid xl:grid-cols-[minmax(9rem,1.1fr)_minmax(18rem,2fr)_minmax(5rem,0.6fr)_minmax(7rem,0.7fr)_max-content]">
              <p className="truncate text-sm font-medium text-foreground">{staffName}</p>
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {priorityChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex max-w-full rounded-md bg-muted/80 px-2 py-0.5 text-[12px] leading-snug text-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
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
                disabled={rowAssignDisabled}
                onClick={() => onAssign(s)}
                aria-label={`${isReplacement ? "Replace with" : "Assign"} ${staffName} on this shift`}
                title={!s.contacted ? "Mark as Contacted before assigning" : undefined}
              >
                {isReplacement ? "Replace" : "Assign"}
              </Button>
            </div>

            <div className="space-y-3 px-4 py-3 xl:hidden">
              <p className="text-sm font-medium text-foreground">{staffName}</p>
              <div className="flex flex-wrap gap-1.5">
                {priorityChips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex rounded-md bg-muted/80 px-2 py-0.5 text-[12px] leading-snug text-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
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
                disabled={rowAssignDisabled}
                onClick={() => onAssign(s)}
                aria-label={`${isReplacement ? "Replace with" : "Assign"} ${staffName} on this shift`}
                title={!s.contacted ? "Mark as Contacted before assigning" : undefined}
              >
                {isReplacement ? "Replace" : "Assign"}
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
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Assigned Carer
        </p>
        <p className="text-sm font-semibold text-foreground">{assignedName}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Manage assignment
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={resendDisabled} onSelect={() => onResend()}>
            Resend confirmation
          </DropdownMenuItem>
          <DropdownMenuItem disabled={unassignDisabled} onSelect={() => onUnassign()}>
            Unassign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
