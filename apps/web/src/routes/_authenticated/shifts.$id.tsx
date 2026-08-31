import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { shiftsApi, centresApi, staffApi, displayStaff, fmtTime, type AvailableStaff, type ShiftStatus } from "@/lib/db";
import { ApiError } from "@/lib/api";
import {
  shiftAssignmentFeedbackMessage,
  shiftResendFeedbackMessage,
  shiftUnassignFeedbackMessage,
} from "@/lib/shift-assignment-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { SearchableCentreSelect } from "@/components/SearchableCentreSelect";
import { PageHeader } from "@/components/PageHeader";
import { DetailLoading } from "@/components/DetailLoading";
import { StatusBadge } from "@/components/StatusBadge";
import { BackLink, ConfirmDestructiveDialog, EmptyState, PropertyList, SectionCard } from "@/components/ui-kit";
import { formatShiftRoleLabel, shiftRoleEditOptions } from "@/lib/shift-role-ui";
import {
  ShiftAssignedCarerBar,
  ShiftAvailableStaffList,
} from "@/components/shifts/ShiftAvailableStaffList";
import {
  detectShiftEditCommunicationChanges,
  hasShiftEditCommunicationChanges,
  isValidCommunicationEmail,
  resolveCarerCommunicationEmail,
  type ShiftUpdateCommunicationsPayload,
} from "@/lib/shift-edit-communications";
import { shiftUpdateFeedbackMessage } from "@/lib/shift-edit-communications-feedback";
import { applyBatchCentreDeferral, isOpenBatchChild } from "@/lib/shift-communication-batch";
import { ShiftEditCommunicationsDialog } from "@/components/shifts/ShiftEditCommunicationsDialog";
import { ShiftAssigneeImpactDialog } from "@/components/shifts/ShiftAssigneeImpactDialog";
import { ShiftAssignmentConfirmDialog } from "@/components/shifts/ShiftAssignmentConfirmDialog";
import { ShiftResendConfirmationDialog } from "@/components/shifts/ShiftResendConfirmationDialog";
import { ShiftUnassignDialog } from "@/components/shifts/ShiftUnassignDialog";
import { ShiftCancelDialog } from "@/components/shifts/ShiftCancelDialog";
import { ShiftActivityLogPanel } from "@/components/shifts/ShiftActivityLogPanel";
import { ShiftComments } from "@/components/ShiftComments";
import { ShiftNotesField } from "@/components/shifts/ShiftNotesField";
import { buildShiftAssignmentConfirmDetails } from "@/lib/shift-assignment-confirm";
import {
  formatAssigneeImpactScheduleLine,
  hasScheduleEditChange,
  hasAssigneeRevalidationEditChange,
  type AssigneeImpactPreview,
  type ShiftAssignmentResolution,
  type ShiftUpdatePreviewResponse,
} from "@/lib/shift-assignee-impact";

export const Route = createFileRoute("/_authenticated/shifts/$id")({
  component: ShiftDetail,
});

type EditVals = {
  centreId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  confirmationNotes: string;
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
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [pendingAssignStaff, setPendingAssignStaff] = useState<AvailableStaff | null>(null);
  const [resendingConfirmations, setResendingConfirmations] = useState(false);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [assigneeImpact, setAssigneeImpact] = useState<AssigneeImpactPreview | null>(null);
  const [assigneePreview, setAssigneePreview] = useState<ShiftUpdatePreviewResponse | null>(null);
  const [pendingAssignmentResolution, setPendingAssignmentResolution] =
    useState<ShiftAssignmentResolution | null>(null);
  const [previewingAssignee, setPreviewingAssignee] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);

  const editValsForQueries: EditVals = edit ?? (shift
    ? {
        centreId: shift.centreId,
        shiftDate: shift.shiftDate,
        startTime: shift.startTime.slice(0, 5),
        endTime: shift.endTime.slice(0, 5),
        roleNeeded: shift.roleNeeded,
        addedToStaffpoint: !!shift.addedToStaffpoint,
        confirmationNotes: shift.confirmationNotes ?? "",
      }
    : {
        centreId: "",
        shiftDate: "",
        startTime: "",
        endTime: "",
        roleNeeded: "",
        addedToStaffpoint: false,
        confirmationNotes: "",
      });

  const centreContactsQ = useQuery({
    enabled: !!shift,
    queryKey: ["centre-contacts", shift?.centreId],
    queryFn: () => centresApi.contacts(shift!.centreId),
  });

  const assignedStaffQ = useQuery({
    enabled: !!shift?.assignedStaffId,
    queryKey: ["staff", shift?.assignedStaffId],
    queryFn: () => staffApi.get(shift!.assignedStaffId!),
  });

  const resendAvailabilityQ = useQuery({
    enabled: !!shift?.assignedStaffId && resendDialogOpen,
    queryKey: ["shift-resend-availability", id],
    queryFn: () => shiftsApi.assignmentConfirmationRecipients(id),
  });

  const editCentreContactsQ = useQuery({
    enabled: !!shift && editing && commDialogOpen,
    queryKey: ["centre-contacts", editValsForQueries.centreId],
    queryFn: () => centresApi.contacts(editValsForQueries.centreId),
  });

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
    addedToStaffpoint: !!shift.addedToStaffpoint,
    confirmationNotes: shift.confirmationNotes ?? "",
  };

  const communicationChanges = detectShiftEditCommunicationChanges(
    {
      shiftDate: shift.shiftDate,
      startTime: shift.startTime,
      endTime: shift.endTime,
      roleNeeded: shift.roleNeeded,
      confirmationNotes: shift.confirmationNotes ?? "",
    },
    {
      shiftDate: editVals.shiftDate,
      startTime: `${editVals.startTime}:00`,
      endTime: `${editVals.endTime}:00`,
      roleNeeded: editVals.roleNeeded,
      confirmationNotes: editVals.confirmationNotes,
    },
  );

  const batchCentreDeferred = isOpenBatchChild(shift);

  const primaryCentreEmail = [...(centreContactsQ.data ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.email;
  const centreCommAvailability = applyBatchCentreDeferral(
    primaryCentreEmail && isValidCommunicationEmail(primaryCentreEmail)
      ? { available: true as const }
      : {
          available: false as const,
          reason: primaryCentreEmail
            ? "Centre primary contact email is invalid."
            : "No centre primary contact email is configured.",
        },
    batchCentreDeferred,
  );

  const carerEmail = assignedStaffQ.data
    ? resolveCarerCommunicationEmail(assignedStaffQ.data)
    : null;
  const carerCommAvailability = shift.assignedStaffId
    ? carerEmail
      ? { available: true as const }
      : { available: false as const, reason: "Assigned Carer has no valid email address." }
    : { available: false as const, reason: "No Carer assigned." };

  const resendCentreAvailability = resendAvailabilityQ.data?.centre ?? centreCommAvailability;
  const resendCarerAvailability = resendAvailabilityQ.data?.carer ?? carerCommAvailability;

  const editPrimaryCentreEmail = [...(editCentreContactsQ.data ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)[0]?.email;
  const centreAvailability = applyBatchCentreDeferral(
    editPrimaryCentreEmail && isValidCommunicationEmail(editPrimaryCentreEmail)
      ? { available: true as const }
      : {
          available: false as const,
          reason: editPrimaryCentreEmail
            ? "Centre primary contact email is invalid."
            : "No centre primary contact email is configured.",
        },
    batchCentreDeferred,
  );

  const editCarerEmail = assignedStaffQ.data
    ? resolveCarerCommunicationEmail(assignedStaffQ.data)
    : null;
  const carerAvailability = shift.assignedStaffId
    ? editCarerEmail
      ? { available: true as const }
      : { available: false as const, reason: "Assigned Carer has no valid email address." }
    : { available: false as const, reason: "No Carer assigned." };

  function buildUpdatePayload(
    communications?: ShiftUpdateCommunicationsPayload,
    assignmentResolution?: ShiftAssignmentResolution,
  ) {
    return {
      centreId: editVals.centreId,
      shiftDate: editVals.shiftDate,
      startTime: editVals.startTime + ":00",
      endTime: editVals.endTime + ":00",
      roleNeeded: editVals.roleNeeded,
      addedToStaffpoint: editVals.addedToStaffpoint,
      confirmationNotes: editVals.confirmationNotes.trim() || null,
      ...(communications ? { communications } : {}),
      ...(assignmentResolution ? { assignmentResolution } : {}),
    };
  }

  function resetAssigneeImpactState() {
    setAssigneeDialogOpen(false);
    setAssigneeImpact(null);
    setAssigneePreview(null);
    setPendingAssignmentResolution(null);
  }

  function proceedAfterAssigneeCheck(resolution?: ShiftAssignmentResolution) {
    const effectiveResolution = resolution ?? pendingAssignmentResolution ?? undefined;
    const unassigning = effectiveResolution === "unassign";
    if (hasShiftEditCommunicationChanges(communicationChanges) || unassigning) {
      setCommDialogOpen(true);
      return;
    }
    void performSave(undefined, effectiveResolution);
  }

  async function performSave(
    communications?: ShiftUpdateCommunicationsPayload,
    assignmentResolution?: ShiftAssignmentResolution,
  ) {
    if (savingEdits) return;
    const resolution = assignmentResolution ?? pendingAssignmentResolution ?? undefined;
    setSavingEdits(true);
    try {
      const result = await shiftsApi.update(id, buildUpdatePayload(communications, resolution));
      const message = shiftUpdateFeedbackMessage(result.communications);
      const partialFailure =
        result.communications &&
        ((result.communications.centre?.attempted &&
          !result.communications.centre.sent &&
          !result.communications.centre.deferred) ||
          (result.communications.carer?.attempted && !result.communications.carer?.sent));
      if (partialFailure) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      setEditing(false);
      setEdit(null);
      setCommDialogOpen(false);
      resetAssigneeImpactState();
      qc.invalidateQueries();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const code = err.details.code;
        if (code === "assignee_impact_required" || code === "assignee_override_not_allowed") {
          const impact = err.details.assigneeImpact as AssigneeImpactPreview | undefined;
          if (impact) {
            setAssigneeImpact(impact);
            setAssigneeDialogOpen(true);
            setPendingAssignmentResolution(null);
            setCommDialogOpen(false);
          }
          toast.error(err.message);
          return;
        }
      }
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdits(false);
    }
  }

  async function saveEdits() {
    if (
      shift.status === "filled" &&
      shift.assignedStaffId &&
      hasAssigneeRevalidationEditChange(
        {
          shiftDate: shift.shiftDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          roleNeeded: shift.roleNeeded,
        },
        editVals,
      )
    ) {
      setPreviewingAssignee(true);
      try {
        const preview = await shiftsApi.previewUpdate(id, {
          shiftDate: editVals.shiftDate,
          startTime: editVals.startTime + ":00",
          endTime: editVals.endTime + ":00",
          roleNeeded: editVals.roleNeeded,
        });
        if (preview.requiresAssignmentResolution && preview.assigneeImpact) {
          setAssigneePreview(preview);
          setAssigneeImpact(preview.assigneeImpact);
          setAssigneeDialogOpen(true);
          return;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not preview schedule impact");
        return;
      } finally {
        setPreviewingAssignee(false);
      }
    }
    proceedAfterAssigneeCheck();
  }

  function handleAssigneeUnassign() {
    setPendingAssignmentResolution("unassign");
    setAssigneeDialogOpen(false);
    proceedAfterAssigneeCheck("unassign");
  }

  function handleAssigneeOverride() {
    setPendingAssignmentResolution("availability_override");
    setAssigneeDialogOpen(false);
    proceedAfterAssigneeCheck("availability_override");
  }

  function handleAssigneeGoBack() {
    resetAssigneeImpactState();
  }

  async function assignStaff(staffId: string, staffLegalName: string): Promise<boolean> {
    if (assigningStaffId) return false;
    setAssigningStaffId(staffId);
    try {
      const result = await shiftsApi.assign(id, staffId);
      const message = shiftAssignmentFeedbackMessage(
        staffLegalName,
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
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
        void qc.invalidateQueries({ queryKey: ["shift-available", id] });
      } else {
        toast.error(err instanceof Error ? err.message : "Assign failed");
      }
      return false;
    } finally {
      setAssigningStaffId(null);
    }
  }

  function openAssignConfirm(staff: AvailableStaff) {
    setPendingAssignStaff(staff);
    setAssignConfirmOpen(true);
  }

  function closeAssignConfirm() {
    setAssignConfirmOpen(false);
    setPendingAssignStaff(null);
  }

  async function confirmAssignStaff() {
    if (!pendingAssignStaff || assigningStaffId) return;
    const success = await assignStaff(pendingAssignStaff.id, pendingAssignStaff.legalName);
    if (success) closeAssignConfirm();
  }

  const assignConfirmDetails = pendingAssignStaff
    ? buildShiftAssignmentConfirmDetails({
        staffLegalName: pendingAssignStaff.legalName,
        centreName: shift.centreName ?? "Centre",
        shiftDate: shift.shiftDate,
        startTime: shift.startTime,
        endTime: shift.endTime,
        roleNeeded: shift.roleNeeded,
      })
    : null;

  async function cancelShift(input: {
    reason: string;
    communications?: { centre: boolean; carer: boolean };
  }) {
    if (cancelling) return;
    setCancelling(true);
    try {
      await shiftsApi.changeStatus(id, "cancelled", {
        cancellationReason: input.reason,
        communications: input.communications,
      });
      toast.success("Shift cancelled");
      setCancelDialogOpen(false);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  }

  async function confirmResend(recipients: { centre: boolean; carer: boolean }) {
    if (resendingConfirmations) return;
    setResendingConfirmations(true);
    try {
      const result = await shiftsApi.resendAssignmentConfirmation(id, recipients);
      const message = shiftResendFeedbackMessage(result.notifications);
      const partialFailure =
        (result.notifications.centre.attempted &&
          !result.notifications.centre.sent &&
          !result.notifications.centre.deferred) ||
        (result.notifications.carer.attempted && !result.notifications.carer.sent);
      if (partialFailure) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      setResendDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend confirmations");
    } finally {
      setResendingConfirmations(false);
    }
  }

  async function confirmUnassign(communications?: { centre: boolean; carer: boolean }) {
    if (unassigning) return;
    setUnassigning(true);
    try {
      const result = await shiftsApi.unassign(id, communications);
      const message = shiftUnassignFeedbackMessage(result.notifications);
      const partialFailure =
        result.notifications &&
        ((result.notifications.centre?.attempted &&
          !result.notifications.centre.sent &&
          !result.notifications.centre.deferred) ||
          (result.notifications.carer?.attempted && !result.notifications.carer?.sent));
      if (partialFailure) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      setUnassignDialogOpen(false);
      qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unassign failed");
    } finally {
      setUnassigning(false);
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

  return (
    <div className="space-y-6">
      <BackLink to="/shifts" label="Back to Shifts" />
      {shift.batchId ? (
        <div className="rounded-lg border border-primary/15 bg-primary/[0.04] px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Part of Batch Request</p>
          <p className="mt-1 text-muted-foreground">
            This shift belongs to a batch workspace.{" "}
            <Link
              to="/shifts/batches/$id"
              params={{ id: shift.batchId }}
              className="font-medium text-foreground underline underline-offset-2"
            >
              Back to Batch
            </Link>
            {batchCentreDeferred ? (
              <>
                {" "}
                Centre confirmations are managed through the Batch Request until it is completed.
              </>
            ) : null}
          </p>
        </div>
      ) : null}
      <PageHeader
        title={shift.centreName ?? "Shift"}
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
              <>
                <PropertyList
                  items={[
                    { label: "Centre", value: shift.centreName },
                    { label: "Date", value: shift.shiftDate },
                    { label: "Time", value: `${fmtTime(shift.startTime)} – ${fmtTime(shift.endTime)}` },
                    { label: "Role", value: formatShiftRoleLabel(shift.roleNeeded) },
                    { label: "Staffpoint", value: shift.addedToStaffpoint ? "Added" : "Not added" },
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
                <div className="mt-5 border-t border-border/70 pt-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Shift Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {shift.confirmationNotes?.trim() || "—"}
                  </p>
                </div>
              </>
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
                      <Label>Role required</Label>
                      <Select value={editVals.roleNeeded || undefined} onValueChange={(v) => setEdit({ ...editVals, roleNeeded: v })}>
                        <SelectTrigger aria-label="Role required"><SelectValue placeholder="Choose role..." /></SelectTrigger>
                        <SelectContent>
                          {shiftRoleEditOptions(shift.roleNeeded).map(({ value, label }) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
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
                <ShiftNotesField
                  id="edit-shift-notes"
                  value={editVals.confirmationNotes}
                  onChange={(v) => setEdit({ ...editVals, confirmationNotes: v })}
                />
                <Button onClick={saveEdits} disabled={savingEdits || previewingAssignee}>
                  Save changes
                </Button>
              </div>
            )}
          </SectionCard>

          {assignedName && (
            <SectionCard id="assignment" title="Assignment" padded={false}>
              <ShiftAssignedCarerBar
                assignedName={assignedName}
                resendDisabled={resendingConfirmations || status !== "filled"}
                unassignDisabled={unassigning || isHistorical}
                onResend={() => setResendDialogOpen(true)}
                onUnassign={() => setUnassignDialogOpen(true)}
              />
            </SectionCard>
          )}

          <SectionCard
            id="available-staff"
            title={
              <span className="flex flex-wrap items-center gap-2">
                Available staff
                <StatusBadge status={shift.status} size="md">{shift.status}</StatusBadge>
              </span>
            }
            action={
              !isHistorical && status !== "cancelled" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/25 text-destructive hover:bg-destructive/5 hover:text-destructive"
                  disabled={cancelling}
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancel shift
                </Button>
              ) : undefined
            }
            padded={false}
          >
            {status === "cancelled" && shift.cancellationReason && (
              <div className="border-b border-border/70 px-4 py-2.5">
                <p className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">Reason:</span> {shift.cancellationReason}
                </p>
              </div>
            )}

            {isHistorical && !assignedName ? (
              <div className="px-4 py-3.5">
                <EmptyState
                  title="No staff was assigned"
                  description="This shift closed without an assignment."
                />
              </div>
            ) : (
              <ShiftAvailableStaffList
                candidates={availableList}
                assignedStaffId={shift.assignedStaffId}
                assignedName={assignedName}
                assignDisabled={assignConfirmOpen || assigningStaffId != null}
                onToggleContacted={toggleContacted}
                onAssign={openAssignConfirm}
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <div className="space-y-6 rounded-xl bg-surface-brand-dusk p-4 lg:p-5">
            <ShiftComments shiftId={id} />
            <ShiftActivityLogPanel shiftId={id} />
          </div>
        </div>
      </div>

      <ShiftAssignmentConfirmDialog
        open={assignConfirmOpen}
        onOpenChange={(open) => {
          if (!open) closeAssignConfirm();
        }}
        details={assignConfirmDetails}
        confirming={assigningStaffId != null}
        batchCentreDeferred={batchCentreDeferred}
        onConfirm={() => void confirmAssignStaff()}
      />

      <ShiftAssigneeImpactDialog
        open={assigneeDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleAssigneeGoBack();
        }}
        impact={
          assigneeImpact ?? {
            status: "must_unassign",
            staffId: "",
            staffName: assignedName ?? "Assigned Carer",
            reasons: [],
            reasonMessages: [],
          }
        }
        scheduleSummary={assigneePreview ? formatAssigneeImpactScheduleLine(assigneePreview) : null}
        onUnassign={handleAssigneeUnassign}
        onOverride={handleAssigneeOverride}
        onGoBack={handleAssigneeGoBack}
      />

      <ShiftEditCommunicationsDialog
        open={commDialogOpen}
        onOpenChange={setCommDialogOpen}
        changes={communicationChanges}
        centreAvailability={centreAvailability}
        carerAvailability={carerAvailability}
        assignmentUnassigned={pendingAssignmentResolution === "unassign"}
        saving={savingEdits}
        onSaveWithoutEmail={() => void performSave()}
        onSaveWithCommunications={(communications) => void performSave(communications)}
      />

      <ShiftResendConfirmationDialog
        open={resendDialogOpen}
        onOpenChange={setResendDialogOpen}
        centreAvailability={resendCentreAvailability}
        carerAvailability={resendCarerAvailability}
        submitting={resendingConfirmations}
        onConfirmSend={(recipients) => void confirmResend(recipients)}
      />

      {assignedName && (
        <ShiftUnassignDialog
          open={unassignDialogOpen}
          onOpenChange={setUnassignDialogOpen}
          carerName={assignedName}
          centreName={shift.centreName ?? "Centre"}
          shiftDate={shift.shiftDate}
          centreAvailability={centreCommAvailability}
          carerAvailability={carerCommAvailability}
          submitting={unassigning}
          onConfirmWithoutEmail={() => void confirmUnassign()}
          onConfirmWithRecipients={(recipients) => void confirmUnassign(recipients)}
        />
      )}

      <ShiftCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        centreAvailability={centreCommAvailability}
        carerAvailability={carerCommAvailability}
        submitting={cancelling}
        onConfirm={(input) => void cancelShift(input)}
      />
    </div>
  );
}
