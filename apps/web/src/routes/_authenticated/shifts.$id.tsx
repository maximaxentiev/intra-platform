import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { shiftsApi, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import {
  shiftAssignmentFeedbackMessage,
  shiftResendFeedbackMessage,
} from "@/lib/shift-assignment-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Star, Trash2, UserCheck, XCircle, AlertTriangle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { ShiftComments } from "@/components/ShiftComments";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { StatusBadge } from "@/components/StatusBadge";

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

  const cancellationQ = useQuery({
    enabled: !!shift,
    queryKey: ["shift-cancellation-request", id],
    queryFn: () => shiftsApi.getCancellationRequest(id),
  });

  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditVals | null>(null);
  const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null);
  const [resendingConfirmations, setResendingConfirmations] = useState(false);
  const [resolvingCancellation, setResolvingCancellation] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");

  if (!shift) return <DetailLoading />;

  // Preserve prior behaviour: only staff matching the required role are shown.
  const availableList = (availableQ.data ?? []).filter((s) => s.role === shift.roleNeeded);

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
      toast.error(err instanceof Error ? err.message : "Assign failed");
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

  async function resolveCancellationRequest() {
    if (resolvingCancellation) return;
    setResolvingCancellation(true);
    try {
      await shiftsApi.resolveCancellationRequest(id, resolutionNote.trim() || undefined);
      toast.success("Cancellation request marked resolved");
      setResolutionNote("");
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resolve request");
    } finally {
      setResolvingCancellation(false);
    }
  }

  const pendingCancellation = cancellationQ.data?.status === "pending" ? cancellationQ.data : null;
  const cancellationStaffName = pendingCancellation
    ? displayStaff({
        legalName: pendingCancellation.staffLegalName,
        displayName: pendingCancellation.staffDisplayName,
        useDisplayName: pendingCancellation.staffUseDisplayName,
      })
    : null;

  async function deleteShift() {
    try {
      await shiftsApi.remove(id);
      toast.success("Shift deleted");
      navigate({ to: "/shifts" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shift"
        backTo="/shifts"
        backLabel="Back to Shifts"
        title={`${shift.centreName ?? "Shift"} · ${shift.shiftDate}`}
        subtitle={`${fmtTime(shift.startTime)} – ${fmtTime(shift.endTime)} · ${shift.roleNeeded || "No role"}`}
        meta={<StatusBadge status={shift.status} size="md">{shift.status}</StatusBadge>}
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Trash2 className="h-4 w-4 mr-2" /> Delete</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
                <AlertDialogDescription>This permanently removes the shift record.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteShift}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />


      {pendingCancellation ? (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-100">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              Cancellation requested
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-foreground">
              <span className="font-medium">{cancellationStaffName}</span> requested to cancel this
              shift.
            </p>
            <div>
              <p className="text-muted-foreground">Reason</p>
              <p className="whitespace-pre-wrap break-words">{pendingCancellation.reason}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Requested{" "}
              {new Date(pendingCancellation.requestedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <div className="space-y-2 border-t border-amber-200 pt-3 dark:border-amber-900">
              <Label htmlFor="resolution-note">Resolution note (optional, internal)</Label>
              <Textarea
                id="resolution-note"
                rows={2}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="e.g. Spoke with Jane and reassigned shift."
                disabled={resolvingCancellation}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={resolvingCancellation}
                onClick={() => void resolveCancellationRequest()}
              >
                {resolvingCancellation ? "Saving…" : "Mark request resolved"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Shift details</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(v => !v); setEdit(null); }}>{editing ? "Cancel" : "Edit"}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editing ? (
                <div className="space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Centre:</span> {shift.centreName}</div>
                  <div><span className="text-muted-foreground">Date:</span> {shift.shiftDate}</div>
                  <div><span className="text-muted-foreground">Time:</span> {fmtTime(shift.startTime)} – {fmtTime(shift.endTime)}</div>
                  <div><span className="text-muted-foreground">Role:</span> {shift.roleNeeded || "—"}</div>
                  <div><span className="text-muted-foreground">Notes:</span> {shift.notes || "—"}</div>
                  <div><span className="text-muted-foreground">Added to Staffpoint:</span> {shift.addedToStaffpoint ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Assigned:</span> {assignedName ?? <span className="italic">Unassigned</span>}
                    {assignedName && <Button size="sm" variant="link" onClick={unassign}>Unassign</Button>}
                  </div>
                  {shift.assignedStaffId && shift.status === "filled" && assignedName ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={resendingConfirmations}
                      onClick={() => void resendConfirmations()}
                    >
                      {resendingConfirmations ? "Sending…" : "Resend confirmations"}
                    </Button>
                  ) : null}
                  {shift.status === "cancelled" && shift.cancellationReason && (
                    <div><span className="text-muted-foreground">Cancellation reason:</span> {shift.cancellationReason}</div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Centre</Label>
                    <SearchableCentreSelect
                      value={editVals.centreId}
                      onChange={v => setEdit({ ...editVals, centreId: v })}
                    />
                  </div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={editVals.shiftDate} onChange={e => setEdit({ ...editVals, shiftDate: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2"><Label>Start</Label><Input type="time" value={editVals.startTime} onChange={e => setEdit({ ...editVals, startTime: e.target.value })} /></div>
                    <div className="space-y-2"><Label>End</Label><Input type="time" value={editVals.endTime} onChange={e => setEdit({ ...editVals, endTime: e.target.value })} /></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Role needed</Label>
                    <Select value={editVals.roleNeeded || undefined} onValueChange={v => setEdit({ ...editVals, roleNeeded: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose role..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ECA">ECA</SelectItem>
                        <SelectItem value="ECE">ECE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={editVals.notes} onChange={e => setEdit({ ...editVals, notes: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Added to Staffpoint</Label>
                    <Select
                      value={editVals.addedToStaffpoint ? "yes" : "no"}
                      onValueChange={v => setEdit({ ...editVals, addedToStaffpoint: v === "yes" })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={saveEdits}>Save changes</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change status</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Select value={shift.status} onValueChange={v => v === "cancelled" ? undefined : changeStatus(v as ShiftStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="filled" disabled={!shift.assignedStaffId}>Filled (needs an assignee)</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <CancelShiftButton onCancel={(reason) => changeStatus("cancelled", reason)} />
              <p className="text-xs text-muted-foreground">Filled shifts are automatically marked Completed once their end time passes.</p>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Available staff for this shift</CardTitle>
              <p className="text-sm text-muted-foreground">Banned staff and anyone already booked at this time are excluded. <Star className="inline h-3.5 w-3.5 text-warning fill-warning -mt-0.5" /> = Top staff for this centre.</p>
            </CardHeader>
            <CardContent>
              {availableList.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">No eligible staff. Everyone active is either banned at this centre or already booked at this time.</div>
              ) : (
                <ul className="divide-y">
                  {availableList.map((s) => {
                    const isAssigned = shift.assignedStaffId === s.id;
                    return (
                    <li
                      key={s.id}
                      className={`flex flex-wrap items-center justify-between gap-2 py-2.5 px-3 rounded-md transition-colors ${
                        isAssigned
                          ? "bg-success-soft border border-success/30 ring-1 ring-success/20"
                          : s.isTop
                            ? "bg-warning-soft/60"
                            : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {s.isTop && <Star className="h-4 w-4 shrink-0 text-warning fill-warning" />}
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${isAssigned ? "text-success" : ""}`}>{displayStaff(s)}</div>
                          <div className="text-xs text-muted-foreground">{s.role || "No role"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                          <Checkbox checked={s.contacted} onCheckedChange={() => toggleContacted(s.id, s.contacted)} />
                          Contacted
                        </label>
                        {isAssigned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success text-success-foreground px-3 py-1 text-xs font-medium">
                            <UserCheck className="h-3.5 w-3.5" />
                            Assigned
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={assigningStaffId === s.id || assigningStaffId != null}
                            onClick={() => assignStaff(s.id, displayStaff(s))}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            {assigningStaffId === s.id ? "Assigning…" : "Assign"}
                          </Button>
                        )}
                      </div>
                    </li>

                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ShiftComments shiftId={id} />
    </div>
  );
}

function CancelShiftButton({ onCancel }: { onCancel: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full"><XCircle className="h-4 w-4 mr-2" /> Cancel this shift</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this shift?</AlertDialogTitle>
          <AlertDialogDescription>Optionally add a reason for internal records.</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Keep shift</AlertDialogCancel>
          <AlertDialogAction onClick={() => { onCancel(reason); setOpen(false); }}>Cancel shift</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
