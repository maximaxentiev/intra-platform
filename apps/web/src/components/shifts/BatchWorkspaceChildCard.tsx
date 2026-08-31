import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShiftNotesField } from "@/components/shifts/ShiftNotesField";
import { ShiftComments } from "@/components/ShiftComments";
import { StatusBadge } from "@/components/StatusBadge";
import { PropertyList } from "@/components/ui-kit";
import {
  batchChildAssigneeLabel,
  canInlineEditBatchChild,
  formatBatchTimeForApi,
} from "@/lib/batch-shift-ui";
import { fmtTime, shiftsApi, type ShiftBatchChildSummary } from "@/lib/db";
import { formatShiftRoleLabel, shiftRoleEditOptions } from "@/lib/shift-role-ui";
import { cn } from "@/lib/utils";

export function BatchWorkspaceChildCard({
  shift,
  index,
  expanded,
  onToggle,
}: {
  shift: ShiftBatchChildSummary;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [editVals, setEditVals] = useState(() => toEditVals(shift));
  const assignee = batchChildAssigneeLabel(shift);
  const editable = canInlineEditBatchChild(shift.status, shift.assignedStaffId);

  async function saveEdits() {
    setSaving(true);
    try {
      await shiftsApi.update(shift.id, {
        shiftDate: editVals.shiftDate,
        startTime: formatBatchTimeForApi(editVals.startTime),
        endTime: formatBatchTimeForApi(editVals.endTime),
        roleNeeded: editVals.roleNeeded,
        addedToStaffpoint: editVals.addedToStaffpoint,
        confirmationNotes: editVals.confirmationNotes.trim() || null,
      });
      toast.success("Shift saved");
      qc.invalidateQueries({ queryKey: ["shift-batch"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="rounded-xl border border-primary/10 bg-primary/[0.035] shadow-xs"
      data-testid={`batch-child-${shift.id}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="mt-0.5 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          #{index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-foreground">
              {shift.shiftDate} · {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}
            </p>
            <StatusBadge status={shift.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatShiftRoleLabel(shift.roleNeeded)} · {shift.addedToStaffpoint ? "Staffpoint" : "Not on Staffpoint"}
            {assignee ? ` · ${assignee}` : " · Unassigned"}
          </p>
        </div>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-primary/10 px-4 py-4">
          {!editable ? (
            <>
              <PropertyList
                items={[
                  { label: "Date", value: shift.shiftDate },
                  {
                    label: "Time",
                    value: `${fmtTime(shift.startTime)} – ${fmtTime(shift.endTime)}`,
                  },
                  { label: "Role", value: formatShiftRoleLabel(shift.roleNeeded) },
                  {
                    label: "Staffpoint",
                    value: shift.addedToStaffpoint ? "Added" : "Not added",
                  },
                  {
                    label: "Assigned Carer",
                    value: assignee ?? "Unassigned",
                  },
                  {
                    label: "Shift Notes",
                    value: shift.confirmationNotes?.trim() || "—",
                    className: "sm:col-span-2",
                  },
                ]}
              />
              <Button asChild variant="outline" size="sm">
                <Link to="/shifts/$id" params={{ id: shift.id }}>
                  Open Shift
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor={`child-date-${shift.id}`}>Date</Label>
                  <Input
                    id={`child-date-${shift.id}`}
                    type="date"
                    value={editVals.shiftDate}
                    onChange={(e) => setEditVals({ ...editVals, shiftDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`child-start-${shift.id}`}>Start</Label>
                  <Input
                    id={`child-start-${shift.id}`}
                    type="time"
                    value={editVals.startTime}
                    onChange={(e) => setEditVals({ ...editVals, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`child-end-${shift.id}`}>End</Label>
                  <Input
                    id={`child-end-${shift.id}`}
                    type="time"
                    value={editVals.endTime}
                    onChange={(e) => setEditVals({ ...editVals, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={editVals.roleNeeded || undefined}
                    onValueChange={(v) => setEditVals({ ...editVals, roleNeeded: v })}
                  >
                    <SelectTrigger aria-label="Role required">
                      <SelectValue placeholder="Choose role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftRoleEditOptions(shift.roleNeeded).map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Staffpoint</Label>
                  <Select
                    value={editVals.addedToStaffpoint ? "yes" : "no"}
                    onValueChange={(v) =>
                      setEditVals({ ...editVals, addedToStaffpoint: v === "yes" })
                    }
                  >
                    <SelectTrigger aria-label="Added to Staffpoint">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="yes">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ShiftNotesField
                id={`child-notes-${shift.id}`}
                value={editVals.confirmationNotes}
                onChange={(v) => setEditVals({ ...editVals, confirmationNotes: v })}
              />

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdits()}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/shifts/$id" params={{ id: shift.id }}>
                    Open Shift
                  </Link>
                </Button>
              </div>
            </>
          )}

          <ShiftComments shiftId={shift.id} />
        </div>
      ) : null}
    </article>
  );
}

function toEditVals(shift: ShiftBatchChildSummary) {
  return {
    shiftDate: shift.shiftDate,
    startTime: shift.startTime.slice(0, 5),
    endTime: shift.endTime.slice(0, 5),
    roleNeeded: shift.roleNeeded,
    addedToStaffpoint: shift.addedToStaffpoint,
    confirmationNotes: shift.confirmationNotes ?? "",
  };
}
