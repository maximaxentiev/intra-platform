import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ShiftComments } from "@/components/ShiftComments";
import {
  ShiftAssignedCarerBar,
  ShiftAvailableStaffList,
} from "@/components/shifts/ShiftAvailableStaffList";
import { ShiftAssigneeImpactDialog } from "@/components/shifts/ShiftAssigneeImpactDialog";
import { ShiftAssignmentConfirmDialog } from "@/components/shifts/ShiftAssignmentConfirmDialog";
import { ShiftCancelDialog } from "@/components/shifts/ShiftCancelDialog";
import { ShiftEditCommunicationsDialog } from "@/components/shifts/ShiftEditCommunicationsDialog";
import { ShiftNotesField } from "@/components/shifts/ShiftNotesField";
import { ShiftResendConfirmationDialog } from "@/components/shifts/ShiftResendConfirmationDialog";
import { ShiftUnassignDialog } from "@/components/shifts/ShiftUnassignDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PropertyList } from "@/components/ui-kit";
import { ApiError } from "@/lib/api";
import { formatBatchTimeForApi } from "@/lib/batch-shift-ui";
import { applyBatchCentreDeferral, isOpenBatchChild } from "@/lib/shift-communication-batch";
import {
  shiftAssignmentFeedbackMessage,
  shiftResendFeedbackMessage,
  shiftUnassignFeedbackMessage,
} from "@/lib/shift-assignment-feedback";
import { buildShiftAssignmentConfirmDetails } from "@/lib/shift-assignment-confirm";
import {
  formatAssigneeImpactScheduleLine,
  hasAssigneeRevalidationEditChange,
  type AssigneeImpactPreview,
  type ShiftAssignmentResolution,
  type ShiftUpdatePreviewResponse,
} from "@/lib/shift-assignee-impact";
import {
  canEditShiftFields,
  isShiftHistorical,
  shouldLoadAvailableStaff,
  showAssignedCarerSection,
} from "@/lib/shift-edit-eligibility";
import {
  detectShiftEditCommunicationChanges,
  hasShiftEditCommunicationChanges,
  isValidCommunicationEmail,
  resolveCarerCommunicationEmail,
  type ShiftUpdateCommunicationsPayload,
} from "@/lib/shift-edit-communications";
import { shiftUpdateFeedbackMessage } from "@/lib/shift-edit-communications-feedback";
import { invalidateShiftOperationalQueries } from "@/lib/shift-query-invalidation";
import { formatShiftRoleLabel, shiftRoleEditOptions } from "@/lib/shift-role-ui";
import {
  centresApi,
  displayStaff,
  fmtTime,
  shiftsApi,
  staffApi,
  type AvailableStaff,
  type ShiftBatchChildSummary,
  type ShiftStatus,
} from "@/lib/db";

type EditVals = {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  confirmationNotes: string;
};

type Props = {
  shiftId: string;
  batchId: string;
  requestCompletedAt: string | null;
  batchCancelled?: boolean;
  centreName: string;
  summary: ShiftBatchChildSummary;
};

const batchWorkspaceFieldClass =
  "border-border/70 bg-white text-foreground focus-visible:border-primary/30 focus-visible:ring-primary/20";

function toEditVals(shift: {
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  confirmationNotes?: string | null;
}): EditVals {
  return {
    shiftDate: shift.shiftDate,
    startTime: shift.startTime.slice(0, 5),
    endTime: shift.endTime.slice(0, 5),
    roleNeeded: shift.roleNeeded,
    addedToStaffpoint: shift.addedToStaffpoint,
    confirmationNotes: shift.confirmationNotes ?? "",
  };
}

export function BatchWorkspaceExpandedChild({
  shiftId,
  batchId,
  requestCompletedAt,
  batchCancelled = false,
  centreName,
  summary,
}: Props) {
  const qc = useQueryClient();

  const shiftQ = useQuery({
    queryKey: ["shift", shiftId],
    queryFn: () => shiftsApi.get(shiftId),
  });

  const shift = shiftQ.data;
  const status = (shift?.status ?? summary.status) as ShiftStatus;
  const assignedStaffId = shift?.assignedStaffId ?? summary.assignedStaffId;
  const historical = isShiftHistorical(status);
  const operationalDisabled = historical || batchCancelled;
  const editable = canEditShiftFields(status) && !batchCancelled;
  const loadMatching = shouldLoadAvailableStaff(status, assignedStaffId);
  const showAssignment = showAssignedCarerSection(status, assignedStaffId);

  const batchCentreDeferred = isOpenBatchChild({
    batchId,
    batchRequestCompletedAt: requestCompletedAt,
    centreCommunicationDeferred: shift?.centreCommunicationDeferred,
  });

  const availableQ = useQuery({
    enabled: loadMatching,
    queryKey: ["shift-available", shiftId],
    queryFn: () => shiftsApi.availableStaff(shiftId),
  });

  const centreContactsQ = useQuery({
    enabled: Boolean(shift?.centreId),
    queryKey: ["centre-contacts", shift?.centreId],
    queryFn: () => centresApi.contacts(shift!.centreId),
  });

  const assignedStaffQ = useQuery({
    enabled: Boolean(assignedStaffId),
    queryKey: ["staff", assignedStaffId],
    queryFn: () => staffApi.get(assignedStaffId!),
  });

  const [editVals, setEditVals] = useState<EditVals>(() => toEditVals(summary));
  const [savingEdits, setSavingEdits] = useState(false);
  const [previewingAssignee, setPreviewingAssignee] = useState(false);
  const [assigningStaffId, setAssigningStaffId] = useState<string | null>(null);
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false);
  const [pendingAssignStaff, setPendingAssignStaff] = useState<AvailableStaff | null>(null);
  const [notifyPreviousCarer, setNotifyPreviousCarer] = useState(true);
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendingConfirmations, setResendingConfirmations] = useState(false);
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [commDialogOpen, setCommDialogOpen] = useState(false);
  const [assigneeDialogOpen, setAssigneeDialogOpen] = useState(false);
  const [assigneeImpact, setAssigneeImpact] = useState<AssigneeImpactPreview | null>(null);
  const [assigneePreview, setAssigneePreview] = useState<ShiftUpdatePreviewResponse | null>(null);
  const [pendingAssignmentResolution, setPendingAssignmentResolution] =
    useState<ShiftAssignmentResolution | null>(null);
  const assignmentResolutionRef = useRef<ShiftAssignmentResolution | null>(null);
  const skipAssigneeResetRef = useRef(false);

  useEffect(() => {
    if (shift) setEditVals(toEditVals(shift));
  }, [
    shift?.id,
    shift?.shiftDate,
    shift?.startTime,
    shift?.endTime,
    shift?.roleNeeded,
    shift?.addedToStaffpoint,
    shift?.confirmationNotes,
    shift?.status,
    shift?.assignedStaffId,
  ]);

  const resendAvailabilityQ = useQuery({
    enabled: Boolean(assignedStaffId) && resendDialogOpen,
    queryKey: ["shift-resend-availability", shiftId],
    queryFn: () => shiftsApi.assignmentConfirmationRecipients(shiftId),
  });

  const editCentreContactsQ = useQuery({
    enabled: commDialogOpen && Boolean(shift?.centreId),
    queryKey: ["centre-contacts", shift?.centreId, "batch-edit"],
    queryFn: () => centresApi.contacts(shift!.centreId),
  });

  const beforeSnapshot = useMemo(
    () =>
      shift
        ? {
            shiftDate: shift.shiftDate,
            startTime: shift.startTime,
            endTime: shift.endTime,
            roleNeeded: shift.roleNeeded,
            confirmationNotes: shift.confirmationNotes ?? "",
          }
        : {
            shiftDate: summary.shiftDate,
            startTime: summary.startTime,
            endTime: summary.endTime,
            roleNeeded: summary.roleNeeded,
            confirmationNotes: summary.confirmationNotes ?? "",
          },
    [shift, summary],
  );

  const communicationChanges = detectShiftEditCommunicationChanges(beforeSnapshot, {
    shiftDate: editVals.shiftDate,
    startTime: `${editVals.startTime}:00`,
    endTime: `${editVals.endTime}:00`,
    roleNeeded: editVals.roleNeeded,
    confirmationNotes: editVals.confirmationNotes,
  });

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

  const editPrimaryCentreEmail = [...(editCentreContactsQ.data ?? centreContactsQ.data ?? [])]
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

  const carerEmail = assignedStaffQ.data ? resolveCarerCommunicationEmail(assignedStaffQ.data) : null;
  const carerCommAvailability = assignedStaffId
    ? carerEmail
      ? { available: true as const }
      : { available: false as const, reason: "Assigned Carer has no valid email address." }
    : { available: false as const, reason: "No Carer assigned." };

  const resendCentreAvailability = resendAvailabilityQ.data?.centre ?? centreCommAvailability;
  const resendCarerAvailability = resendAvailabilityQ.data?.carer ?? carerCommAvailability;

  const assignedName =
    assignedStaffId && (shift?.assignedLegalName ?? summary.assignedLegalName)
      ? displayStaff({
          legalName: shift?.assignedLegalName ?? summary.assignedLegalName ?? "",
          displayName: shift?.assignedDisplayName ?? summary.assignedDisplayName ?? "",
          useDisplayName: shift?.assignedUseDisplayName ?? summary.assignedUseDisplayName ?? false,
        })
      : null;

  function refreshAfterOperation() {
    invalidateShiftOperationalQueries(qc, shiftId, batchId);
  }

  function buildUpdatePayload(
    communications?: ShiftUpdateCommunicationsPayload,
    assignmentResolution?: ShiftAssignmentResolution,
  ) {
    return {
      shiftDate: editVals.shiftDate,
      startTime: formatBatchTimeForApi(editVals.startTime),
      endTime: formatBatchTimeForApi(editVals.endTime),
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
    assignmentResolutionRef.current = null;
  }

  function chooseAssignmentResolution(resolution: ShiftAssignmentResolution) {
    assignmentResolutionRef.current = resolution;
    setPendingAssignmentResolution(resolution);
    skipAssigneeResetRef.current = true;
    setAssigneeDialogOpen(false);
    proceedAfterAssigneeCheck(resolution);
  }

  async function performSave(
    communications?: ShiftUpdateCommunicationsPayload,
    assignmentResolution?: ShiftAssignmentResolution,
  ) {
    if (savingEdits) return;
    const resolution =
      assignmentResolution ?? assignmentResolutionRef.current ?? pendingAssignmentResolution ?? undefined;
    setSavingEdits(true);
    try {
      const result = await shiftsApi.update(shiftId, buildUpdatePayload(communications, resolution));
      const message = shiftUpdateFeedbackMessage(result.communications);
      const partialFailure =
        result.communications &&
        ((result.communications.centre?.attempted &&
          !result.communications.centre.sent &&
          !result.communications.centre.deferred) ||
          (result.communications.carer?.attempted && !result.communications.carer?.sent));
      if (partialFailure) toast.warning(message);
      else toast.success(message);
      setCommDialogOpen(false);
      resetAssigneeImpactState();
      refreshAfterOperation();
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const code = err.details.code;
        if (code === "assignee_impact_required" || code === "assignee_override_not_allowed") {
          const impact = err.details.assigneeImpact as AssigneeImpactPreview | undefined;
          if (impact) {
            setAssigneeImpact(impact);
            setAssigneeDialogOpen(true);
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

  function proceedAfterAssigneeCheck(resolution?: ShiftAssignmentResolution) {
    const effectiveResolution = resolution ?? pendingAssignmentResolution ?? undefined;
    const unassigning = effectiveResolution === "unassign";
    const hasCarer = Boolean(assignedStaffId);
    if (hasCarer && (hasShiftEditCommunicationChanges(communicationChanges) || unassigning)) {
      setCommDialogOpen(true);
      return;
    }
    if (!hasCarer && hasShiftEditCommunicationChanges(communicationChanges)) {
      if (!window.confirm("Save these changes?")) return;
    }
    void performSave(undefined, effectiveResolution);
  }

  async function saveEdits() {
    if (
      status === "filled" &&
      assignedStaffId &&
      hasAssigneeRevalidationEditChange(beforeSnapshot, editVals)
    ) {
      setPreviewingAssignee(true);
      try {
        const preview = await shiftsApi.previewUpdate(shiftId, {
          shiftDate: editVals.shiftDate,
          startTime: formatBatchTimeForApi(editVals.startTime),
          endTime: formatBatchTimeForApi(editVals.endTime),
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

  async function assignStaff(
    staffId: string,
    staffLegalName: string,
    options?: { notifyPreviousCarer?: boolean },
  ): Promise<boolean> {
    if (assigningStaffId) return false;
    setAssigningStaffId(staffId);
    try {
      const result = await shiftsApi.assign(shiftId, staffId, {
        notifyPreviousCarer: options?.notifyPreviousCarer,
      });
      const message = shiftAssignmentFeedbackMessage(
        staffLegalName,
        result.assignment,
        result.notifications,
      );
      if (result.assignment.alreadyAssigned) toast.message(message);
      else if (
        result.notifications &&
        ((!result.notifications.centre.sent &&
          result.notifications.centre.attempted &&
          !result.notifications.centre.deferred) ||
          (!result.notifications.carer.sent && result.notifications.carer.attempted) ||
          result.notifications.centre.skippedReason === "no_centre_primary_contact" ||
          result.notifications.centre.skippedReason === "document_share_unavailable" ||
          result.notifications.carer.skippedReason === "no_carer_email")
      ) {
        toast.warning(message);
      } else {
        toast.success(message);
      }
      refreshAfterOperation();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
        void qc.invalidateQueries({ queryKey: ["shift-available", shiftId] });
      } else {
        toast.error(err instanceof Error ? err.message : "Assign failed");
      }
      return false;
    } finally {
      setAssigningStaffId(null);
    }
  }

  async function confirmAssignStaff() {
    if (!pendingAssignStaff || assigningStaffId) return;
    const isReassignment =
      assignedStaffId != null && assignedStaffId !== pendingAssignStaff.id;
    const success = await assignStaff(pendingAssignStaff.id, pendingAssignStaff.legalName, {
      notifyPreviousCarer: isReassignment ? notifyPreviousCarer : undefined,
    });
    if (success) {
      setAssignConfirmOpen(false);
      setPendingAssignStaff(null);
      setNotifyPreviousCarer(true);
    }
  }

  async function toggleContacted(staffId: string, currentlyContacted: boolean) {
    try {
      if (currentlyContacted) await shiftsApi.unmarkContacted(shiftId, staffId);
      else await shiftsApi.markContacted(shiftId, staffId);
      void qc.invalidateQueries({ queryKey: ["shift-available", shiftId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function confirmResend(recipients: { centre: boolean; carer: boolean }) {
    if (resendingConfirmations) return;
    setResendingConfirmations(true);
    try {
      const result = await shiftsApi.resendAssignmentConfirmation(shiftId, recipients);
      const message = shiftResendFeedbackMessage(result.notifications);
      const partialFailure =
        (result.notifications.centre.attempted &&
          !result.notifications.centre.sent &&
          !result.notifications.centre.deferred) ||
        (result.notifications.carer.attempted && !result.notifications.carer.sent);
      if (partialFailure) toast.warning(message);
      else toast.success(message);
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
      const result = await shiftsApi.unassign(shiftId, communications);
      const message = shiftUnassignFeedbackMessage(result.notifications);
      const partialFailure =
        result.notifications &&
        ((result.notifications.centre?.attempted &&
          !result.notifications.centre.sent &&
          !result.notifications.centre.deferred) ||
          (result.notifications.carer?.attempted && !result.notifications.carer?.sent));
      if (partialFailure) toast.warning(message);
      else toast.success(message);
      setUnassignDialogOpen(false);
      refreshAfterOperation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unassign failed");
    } finally {
      setUnassigning(false);
    }
  }

  async function cancelShift(input: {
    reason: string;
    communications?: { centre: boolean; carer: boolean };
  }) {
    if (cancelling) return;
    setCancelling(true);
    try {
      await shiftsApi.changeStatus(shiftId, "cancelled", {
        cancellationReason: input.reason,
        communications: input.communications,
      });
      toast.success("Shift cancelled");
      setCancelDialogOpen(false);
      refreshAfterOperation();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  }

  const assignConfirmDetails = pendingAssignStaff
    ? buildShiftAssignmentConfirmDetails({
        staffLegalName: pendingAssignStaff.legalName,
        centreName,
        shiftDate: shift?.shiftDate ?? summary.shiftDate,
        startTime: shift?.startTime ?? summary.startTime,
        endTime: shift?.endTime ?? summary.endTime,
        roleNeeded: shift?.roleNeeded ?? summary.roleNeeded,
      })
    : null;

  if (shiftQ.isLoading && !shift) {
    return (
      <div className="border-t border-primary/10 px-4 py-6 text-sm text-muted-foreground">
        Loading shift details…
      </div>
    );
  }

  if (shiftQ.isError) {
    return (
      <div className="space-y-3 border-t border-primary/10 px-4 py-4">
        <p className="text-sm text-destructive">Could not load shift details.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void shiftQ.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const isPendingReassignment =
    pendingAssignStaff != null &&
    assignedStaffId != null &&
    assignedStaffId !== pendingAssignStaff.id;

  return (
    <div
      className="space-y-0 border-t border-primary/20 px-4 py-4"
      data-testid={`batch-child-expanded-${shiftId}`}
    >
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/shifts/$id" params={{ id: shiftId }}>
            Open Shift
          </Link>
        </Button>
        {!operationalDisabled && status !== "cancelled" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="More shift actions">
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setCancelDialogOpen(true)}
              >
                Cancel shift
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <section aria-labelledby={`batch-shift-details-${shiftId}`} className="space-y-4 pb-6">
        <h3
          id={`batch-shift-details-${shiftId}`}
          className="text-sm font-bold uppercase tracking-wide text-foreground"
        >
          Shift details
        </h3>
        <div className="space-y-4 rounded-lg border border-primary/10 bg-white p-3">
              {editable ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`batch-date-${shiftId}`}>Date</Label>
                      <Input
                        id={`batch-date-${shiftId}`}
                        type="date"
                        className={batchWorkspaceFieldClass}
                        value={editVals.shiftDate}
                        onChange={(e) => setEditVals({ ...editVals, shiftDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`batch-start-${shiftId}`}>Start</Label>
                      <Input
                        id={`batch-start-${shiftId}`}
                        type="time"
                        className={batchWorkspaceFieldClass}
                        value={editVals.startTime}
                        onChange={(e) => setEditVals({ ...editVals, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`batch-end-${shiftId}`}>End</Label>
                      <Input
                        id={`batch-end-${shiftId}`}
                        type="time"
                        className={batchWorkspaceFieldClass}
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
                        <SelectTrigger className={batchWorkspaceFieldClass} aria-label="Role required">
                          <SelectValue placeholder="Choose role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {shiftRoleEditOptions(editVals.roleNeeded).map(({ value, label }) => (
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
                        <SelectTrigger className={batchWorkspaceFieldClass} aria-label="Added to Staffpoint">
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
                    id={`batch-notes-${shiftId}`}
                    compact
                    inputClassName={batchWorkspaceFieldClass}
                    value={editVals.confirmationNotes}
                    onChange={(v) => setEditVals({ ...editVals, confirmationNotes: v })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingEdits || previewingAssignee}
                    onClick={() => void saveEdits()}
                  >
                    {savingEdits ? "Saving…" : "Save changes"}
                  </Button>
                </>
              ) : (
                <PropertyList
                  items={[
                    { label: "Date", value: summary.shiftDate },
                    {
                      label: "Time",
                      value: `${fmtTime(summary.startTime)} – ${fmtTime(summary.endTime)}`,
                    },
                    { label: "Role", value: formatShiftRoleLabel(summary.roleNeeded) },
                    {
                      label: "Staffpoint",
                      value: summary.addedToStaffpoint ? "Added" : "Not added",
                    },
                    ...(status === "cancelled" && shift?.cancellationReason
                      ? [{ label: "Cancellation reason", value: shift.cancellationReason }]
                      : []),
                  ]}
                />
              )}
        </div>
      </section>

      <hr className="border-border/60" />

      <section aria-labelledby={`batch-assignment-${shiftId}`} className="space-y-4 py-6">
        <h3
          id={`batch-assignment-${shiftId}`}
          className="text-sm font-bold uppercase tracking-wide text-foreground"
        >
          {showAssignment ? "Assignment" : "Available staff"}
        </h3>

        <div className="overflow-hidden rounded-lg border border-border/70 bg-background/70">
          {showAssignment && assignedName ? (
            <ShiftAssignedCarerBar
              assignedName={assignedName}
              resendDisabled={resendingConfirmations || status !== "filled"}
              unassignDisabled={unassigning || operationalDisabled}
              onResend={() => setResendDialogOpen(true)}
              onUnassign={() => setUnassignDialogOpen(true)}
            />
          ) : null}

          {loadMatching ? (
            availableQ.isLoading ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading available staff…</p>
            ) : availableQ.isError ? (
              <div className="space-y-2 px-4 py-3">
                <p className="text-sm text-destructive">Could not load available staff.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void availableQ.refetch()}>
                  Retry
                </Button>
              </div>
            ) : (
              <ShiftAvailableStaffList
                candidates={availableQ.data ?? []}
                assignedStaffId={assignedStaffId}
                assignedName={assignedName}
                assignDisabled={batchCancelled || assignConfirmOpen || assigningStaffId != null}
                onToggleContacted={toggleContacted}
                onAssign={(staff) => {
                  setPendingAssignStaff(staff);
                  setNotifyPreviousCarer(true);
                  setAssignConfirmOpen(true);
                }}
              />
            )
          ) : null}

          {!showAssignment && !loadMatching && historical && !assignedName ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              This shift closed without an assignment.
            </p>
          ) : null}

          {status === "cancelled" && shift?.cancellationReason ? (
            <p className="border-t border-border/70 px-4 py-2.5 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">Reason:</span>{" "}
              {shift.cancellationReason}
            </p>
          ) : null}
        </div>
      </section>

      <hr className="border-border/60" />

      <section className="space-y-4 pt-2">
        {!editable ? (
          <div aria-labelledby={`batch-shift-notes-read-${shiftId}`}>
            <h3
              id={`batch-shift-notes-read-${shiftId}`}
              className="text-sm font-bold uppercase tracking-wide text-foreground"
            >
              Shift Notes
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Shared in Shift confirmation communications.
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {summary.confirmationNotes?.trim() || shift?.confirmationNotes?.trim() || "—"}
            </p>
          </div>
        ) : null}

        <ShiftComments shiftId={shiftId} enabled inputClassName={batchWorkspaceFieldClass} />
      </section>

      <ShiftAssignmentConfirmDialog
        open={assignConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignConfirmOpen(false);
            setPendingAssignStaff(null);
            setNotifyPreviousCarer(true);
          }
        }}
        details={assignConfirmDetails}
        reassignment={
          isPendingReassignment && assignedName
            ? { currentCarerName: assignedName }
            : null
        }
        notifyPreviousCarer={notifyPreviousCarer}
        onNotifyPreviousCarerChange={setNotifyPreviousCarer}
        confirming={assigningStaffId != null}
        batchCentreDeferred={batchCentreDeferred}
        onConfirm={() => void confirmAssignStaff()}
      />

      <ShiftAssigneeImpactDialog
        open={assigneeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            if (skipAssigneeResetRef.current) {
              skipAssigneeResetRef.current = false;
              return;
            }
            resetAssigneeImpactState();
          }
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
        onUnassign={() => chooseAssignmentResolution("unassign")}
        onOverride={() => chooseAssignmentResolution("availability_override")}
        onGoBack={resetAssigneeImpactState}
      />

      <ShiftEditCommunicationsDialog
        open={commDialogOpen}
        onOpenChange={setCommDialogOpen}
        changes={communicationChanges}
        centreAvailability={centreAvailability}
        carerAvailability={carerCommAvailability}
        assignmentUnassigned={
          (assignmentResolutionRef.current ?? pendingAssignmentResolution) === "unassign"
        }
        saving={savingEdits}
        onSaveWithoutEmail={() =>
          void performSave(undefined, assignmentResolutionRef.current ?? pendingAssignmentResolution ?? undefined)
        }
        onSaveWithCommunications={(communications) =>
          void performSave(
            communications,
            assignmentResolutionRef.current ?? pendingAssignmentResolution ?? undefined,
          )
        }
      />

      <ShiftResendConfirmationDialog
        open={resendDialogOpen}
        onOpenChange={setResendDialogOpen}
        centreAvailability={resendCentreAvailability}
        carerAvailability={resendCarerAvailability}
        submitting={resendingConfirmations}
        onConfirmSend={(recipients) => void confirmResend(recipients)}
      />

      {assignedName ? (
        <ShiftUnassignDialog
          open={unassignDialogOpen}
          onOpenChange={setUnassignDialogOpen}
          carerName={assignedName}
          centreName={centreName}
          shiftDate={shift?.shiftDate ?? summary.shiftDate}
          centreAvailability={centreCommAvailability}
          carerAvailability={carerCommAvailability}
          submitting={unassigning}
          onConfirmWithoutEmail={() => void confirmUnassign()}
          onConfirmWithRecipients={(recipients) => void confirmUnassign(recipients)}
        />
      ) : null}

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
