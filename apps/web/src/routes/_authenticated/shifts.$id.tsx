import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { shiftsApi, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  shiftAssignmentFeedbackMessage,
  shiftResendFeedbackMessage,
} from "@/lib/shift-assignment-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MoreHorizontal, Star, Trash2, UserCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { ShiftComments } from "@/components/ShiftComments";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { StatusBadge } from "@/components/StatusBadge";
import { BackLink, ConfirmDestructiveDialog, EmptyState, PropertyList, SectionCard } from "@/components/ui-kit";
import { normalizeCancellationReason } from "@/lib/shifts-lifecycle-ui";

export const Route = createFileRoute("/_authenticated/shifts/$id")({
  component: ShiftDetail,
});

type EditVals = {
  centreId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  notes: string;
  addedToStaffpoint: boolean;
};

const STATUS_SUMMARY: Record<ShiftStatus, string> = {
  pending: "Pending until staff is assigned.",
  filled: "Staff assigned.",
  completed: "Automatically completed after the scheduled end time.",
  cancelled: "This shift was cancelled.",
};

function FieldGroup({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function ShiftDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const shiftQ = useQuery({
    queryKey: ["shift", id],
    queryFn: () => shiftsApi.get(id),
  });

  const shift = shiftQ.data;

  // Server computes eligibility (active, not banned, not double-booked) and
  // annotates isTop + contacted.
  const availableQ = useQuery({
    enabled: !!shift,
    queryKey: ["shift-available", id],
    queryFn: () => shiftsApi.availableStaff(id),
  });

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditVals | null>(null);
  const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null);
  const [resendingConfirmations, setResendingConfirmations] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!shift) return <DetailLoading />;

  const availableList = availableQ.data ?? [];

  const assignedName =
    shift.assignedStaffId && shift.assignedLegalName
      ? displayStaff({
          legalName: shift.assignedLegalName,
          displayName: shift.assignedDisplayName ?? "",
          useDisplayName: shift.assignedUseDisplayName ?? false,
        })
      : null;

  const editVals: EditVals = edit ?? {
    centreId: shift.centreId,
    shiftDate: shift.shiftDate,
    startTime: shift.startTime.slice(0, 5),
    endTime: shift.endTime.slice(0, 5),
    roleNeeded: shift.roleNeeded,
    notes: shift.notes,
    addedToStaffpoint: !!shift.addedToStaffpoint,
  };

  async function saveEdits() {
    try {
      await shiftsApi.update(id, {
        centreId: editVals.centreId,
        shiftDate: editVals.shiftDate,
        startTime: editVals.startTime + ":00",
        endTime: editVals.endTime + ":00",
        roleNeeded: editVals.roleNeeded,
        notes: editVals.notes,
        addedToStaffpoint: editVals.addedToStaffpoint,
      });
      toast.success("Shift updated");
      setEditing(false);
      setEdit(null);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function changeStatus(newStatus: ShiftStatus, reason?: string) {
    try {
      await shiftsApi.changeStatus(id, newStatus, reason);
      toast.success(`Status changed to ${newStatus}`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed");
    }
  }

  async function assignStaff(staffId: string, staffName: string) {
    if (assigningStaffId) return;
    setAssigningStaffId(staffId);
    try {
      const result = await shiftsApi.assign(id, staffId);
      const message = shiftAssignmentFeedbackMessage(
        staffName,
        result.assignment,
        result.notifications,
      );
      if (result.assignment.alreadyAssigned) {
        toast.message(message);
      } else if (
        result.notifications &&
        ((!result.notifications.centre.sent && result.notifications.centre.attempted) ||
          (!result.notifications.carer.sent && result.notifications.carer.attempted) ||
          result.notifications.centre.skippedReason === "no_centre_primary_contact" ||
          result.notifications.centre.skippedReason === "document_share_unavailable" ||
          result.notifications.carer.skippedReason === "no_carer_email")
      ) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      qc.invalidateQueries();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
        void qc.invalidateQueries({ queryKey: ["shift-available", id] });
      } else {
        toast.error(err instanceof Error ? err.message : "Assign failed");
      }
    } finally {
      setAssigningStaffId(null);
    }
  }

  async function resendConfirmations() {
    if (resendingConfirmations) return;
    setResendingConfirmations(true);
    try {
      const result = await shiftsApi.resendAssignmentConfirmation(id);
      const message = shiftResendFeedbackMessage(result.notifications);
      if (result.notifications.centre.sent && result.notifications.carer.sent) {
        toast.success(message);
      } else {
        toast.warning(message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend confirmations");
    } finally {
      setResendingConfirmations(false);
    }
  }

  async function unassign() {
    try {
      await shiftsApi.unassign(id);
      toast.success("Assignment cleared");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unassign failed");
    }
  }

  async function toggleContacted(staffId: string, currentlyContacted: boolean) {
    try {
      if (currentlyContacted) await shiftsApi.unmarkContacted(id, staffId);
      else await shiftsApi.markContacted(id, staffId);
      qc.invalidateQueries({ queryKey: ["shift-available", id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function deleteShift() {
    try {
      await shiftsApi.remove(id);
      toast.success("Shift deleted");
      navigate({ to: "/shifts" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const status = shift.status as ShiftStatus;
  const isHistorical = status === "completed" || status === "cancelled";
  const otherCandidates = availableList.filter((s) => s.id !== shift.assignedStaffId);

  return (
    <div className="space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />
      <PageHeader
        title={shift.centreName ?? "Shift"}
        meta={<StatusBadge status={shift.status} size="md">{shift.status}</StatusBadge>}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="More shift actions"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete shift
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmDestructiveDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this shift?"
              consequence="This permanently removes the shift record. It cannot be undone."
              confirmLabel="Delete shift"
              onConfirm={deleteShift}
            />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Assignment — the primary operational workflow */}
          <SectionCard
            id="assignment"
            title={assignedName ? "Assignment" : "Available staff"}
            description={
              assignedName
                ? "This shift is staffed."
                : "Eligible based on availability, conflicts, centre restrictions and compliance."
            }
            padded={false}
          >
            {assignedName && (
              <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-success-soft/60 px-4 py-3">
                <UserCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Assigned staff
                  </p>
                  <p className="text-sm font-semibold text-foreground">{assignedName}</p>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {status === "filled" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={resendingConfirmations}
                      onClick={() => void resendConfirmations()}
                    >
                      {resendingConfirmations ? "Sending…" : "Resend confirmations"}
                    </Button>
                  )}
                  {!isHistorical && (
                    <Button type="button" variant="ghost" size="sm" onClick={unassign}>
                      Unassign
                    </Button>
                  )}
                </div>
              </div>
            )}

            {isHistorical && !assignedName ? (
              <div className="px-4 py-3.5">
                <EmptyState
                  title="No staff was assigned"
                  description="This shift closed without an assignment."
                />
              </div>
            ) : otherCandidates.length === 0 ? (
              <div className="px-4 py-3.5">
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
                  className="text-left"
                />
              </div>
            ) : (
              <>
                {assignedName && (
                  <p className="px-4 pt-3 text-[13px] text-muted-foreground">
                    Other eligible staff. Eligible staff are filtered automatically using availability,
                    scheduling conflicts, centre restrictions, account status, role, and document compliance.
                  </p>
                )}
                <ul className="divide-y divide-border/60">
                  {otherCandidates.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 transition-colors hover:bg-muted/40 motion-reduce:transition-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{displayStaff(s)}</p>
                        <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                          <span>{s.role || "No role"}</span>
                          {s.isTop && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-foreground">
                              <Star className="h-3 w-3 fill-warning text-warning" aria-hidden />
                              Top staff
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <label className="flex cursor-pointer select-none items-center gap-2 text-[13px]">
                          <Checkbox
                            checked={s.contacted}
                            onCheckedChange={() => toggleContacted(s.id, s.contacted)}
                            aria-label={`Mark ${displayStaff(s)} as contacted`}
                          />
                          Contacted
                        </label>
                        <Button
                          size="sm"
                          disabled={assigningStaffId === s.id || assigningStaffId != null}
                          onClick={() => assignStaff(s.id, displayStaff(s))}
                          aria-label={`Assign ${displayStaff(s)} to this shift`}
                        >
                          {assigningStaffId === s.id ? "Assigning…" : "Assign"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SectionCard>

          {/* Supporting information */}
          <SectionCard
            id="shift-details"
            title="Shift details"
            action={
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing((v) => !v);
                  setEdit(null);
                }}
              >
                {editing ? "Cancel" : "Edit"}
              </Button>
            }
          >
            {!editing ? (
              <PropertyList
                items={[
                  { label: "Centre", value: shift.centreName },
                  { label: "Date", value: shift.shiftDate },
                  { label: "Time", value: `${fmtTime(shift.startTime)} – ${fmtTime(shift.endTime)}` },
                  { label: "Role", value: shift.roleNeeded },
                  { label: "Staffpoint", value: shift.addedToStaffpoint ? "Added" : "Not added" },
                  { label: "Assigned staff", value: assignedName ?? undefined },
                  { label: "Notes", value: shift.notes, className: "sm:col-span-2" },
                  ...(status === "cancelled" && shift.cancellationReason
                    ? [
                        {
                          label: "Cancellation reason",
                          value: shift.cancellationReason,
                          className: "sm:col-span-2",
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <div className="space-y-5">
                <FieldGroup legend="Where">
                  <div className="space-y-2">
                    <Label>Centre</Label>
                    <SearchableCentreSelect
                      value={editVals.centreId}
                      onChange={(v) => setEdit({ ...editVals, centreId: v })}
                    />
                  </div>
                </FieldGroup>
                <FieldGroup legend="When">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-date">Date</Label>
                      <Input id="edit-date" type="date" value={editVals.shiftDate} onChange={(e) => setEdit({ ...editVals, shiftDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-start">Start time</Label>
                      <Input id="edit-start" type="time" value={editVals.startTime} onChange={(e) => setEdit({ ...editVals, startTime: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-end">End time</Label>
                      <Input id="edit-end" type="time" value={editVals.endTime} onChange={(e) => setEdit({ ...editVals, endTime: e.target.value })} />
                    </div>
                  </div>
                </FieldGroup>
                <FieldGroup legend="Requirements">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Role needed</Label>
                      <Select value={editVals.roleNeeded || undefined} onValueChange={(v) => setEdit({ ...editVals, roleNeeded: v })}>
                        <SelectTrigger aria-label="Role needed"><SelectValue placeholder="Choose role..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ECA">ECA</SelectItem>
                          <SelectItem value="ECE">ECE</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Added to Staffpoint</Label>
                      <Select
                        value={editVals.addedToStaffpoint ? "yes" : "no"}
                        onValueChange={(v) => setEdit({ ...editVals, addedToStaffpoint: v === "yes" })}
                      >
                        <SelectTrigger aria-label="Added to Staffpoint"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no">No</SelectItem>
                          <SelectItem value="yes">Yes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </FieldGroup>
                <FieldGroup legend="Internal">
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea id="edit-notes" rows={3} value={editVals.notes} onChange={(e) => setEdit({ ...editVals, notes: e.target.value })} />
                  </div>
                </FieldGroup>
                <Button onClick={saveEdits}>Save changes</Button>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Lifecycle */}
        <div className="lg:col-span-1">
          <SectionCard id="lifecycle" title="Shift status">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={shift.status} size="md">{shift.status}</StatusBadge>
              </div>
              <p className="text-[13px] text-muted-foreground">{STATUS_SUMMARY[status]}</p>

              {status === "cancelled" && shift.cancellationReason && (
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span> {shift.cancellationReason}
                </p>
              )}

              {!isHistorical && (
                <div className="space-y-2 border-t border-border/70 pt-3">
                  {status === "filled" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        onClick={() => changeStatus("completed")}
                      >
                        Mark completed
                      </Button>
                      <p className="text-[13px] text-muted-foreground">
                        Filled shifts are automatically marked Completed once their end time passes.
                      </p>
                    </>
                  )}
                  <CancelShiftButton onCancel={(reason) => changeStatus("cancelled", reason)} />
                </div>
              )}

            </div>
          </SectionCard>
        </div>
      </div>

      <ShiftComments shiftId={id} />
    </div>
  );
}

function CancelShiftButton({ onCancel }: { onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const normalizedReason = normalizeCancellationReason(reason);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setReason("");
  }

  function submitCancellation() {
    const trimmed = normalizeCancellationReason(reason);
    if (!trimmed) return;
    onCancel(trimmed);
    setReason("");
    setOpen(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          Cancel shift
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
          <AlertDialogDescription>
            The shift stays on record as Cancelled and any assigned staff member is kept for history.
            A reason is required for internal records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Cancellation reason *</Label>
          <Textarea
            id="cancel-reason"
            required
            placeholder="Why is this shift being cancelled?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={reason.length > 0 && !normalizedReason}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep shift</AlertDialogCancel>
          <AlertDialogAction disabled={!normalizedReason} onClick={submitCancellation}>
            Cancel shift
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
