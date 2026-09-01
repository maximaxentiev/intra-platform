import type { ShiftBatchChildSummary, ShiftStatus } from "@/lib/db";

export const SHIFT_NOTES_MAX_LENGTH = 5000;
export const INTERNAL_COMMENT_MAX_LENGTH = 5000;

export type BatchDraftShift = {
  key: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  confirmationNotes: string;
  internalComment: string;
  detailsOpen: boolean;
};

export type BatchDraftFieldErrors = Partial<
  Record<
    "shiftDate" | "startTime" | "endTime" | "roleNeeded" | "confirmationNotes" | "internalComment",
    string
  >
>;

export type BatchProgressSummary = {
  activeTotal: number;
  fulfilledCount: number;
  cancelledCount: number;
  percentage: number;
};

export type BatchDisplayState =
  | "open"
  | "ready"
  | "completed"
  | "updates_required"
  | "ready_to_send_updates";

export type BatchConfirmationUiState = BatchDisplayState;

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

function timeToMinutes(time: string): number | null {
  const match = TIME_RE.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function createEmptyBatchDraftShift(key = crypto.randomUUID()): BatchDraftShift {
  return {
    key,
    shiftDate: "",
    startTime: "",
    endTime: "",
    roleNeeded: "",
    addedToStaffpoint: false,
    confirmationNotes: "",
    internalComment: "",
    detailsOpen: false,
  };
}

export function duplicateBatchDraftShift(source: BatchDraftShift): BatchDraftShift {
  return {
    ...createEmptyBatchDraftShift(),
    shiftDate: source.shiftDate,
    startTime: source.startTime,
    endTime: source.endTime,
    roleNeeded: source.roleNeeded,
    addedToStaffpoint: source.addedToStaffpoint,
    confirmationNotes: source.confirmationNotes,
    internalComment: "",
    detailsOpen: source.detailsOpen,
  };
}

export function batchDraftRowHasContent(row: BatchDraftShift): boolean {
  return Boolean(
    row.shiftDate ||
      row.startTime ||
      row.endTime ||
      row.roleNeeded ||
      row.confirmationNotes.trim() ||
      row.internalComment.trim() ||
      row.addedToStaffpoint,
  );
}

export function validateBatchDraftRow(row: BatchDraftShift): BatchDraftFieldErrors {
  const errors: BatchDraftFieldErrors = {};

  if (!row.shiftDate) errors.shiftDate = "Date is required.";
  if (!row.startTime) errors.startTime = "Start time is required.";
  if (!row.endTime) errors.endTime = "End time is required.";
  if (!row.roleNeeded) errors.roleNeeded = "Role is required.";

  if (row.startTime && row.endTime) {
    const startMinutes = timeToMinutes(row.startTime);
    const endMinutes = timeToMinutes(row.endTime);
    if (startMinutes == null) errors.startTime = "Invalid start time.";
    else if (endMinutes == null) errors.endTime = "Invalid end time.";
    else if (endMinutes <= startMinutes) {
      errors.endTime = "End time must be after start time.";
    }
  }

  if (row.confirmationNotes.length > SHIFT_NOTES_MAX_LENGTH) {
    errors.confirmationNotes = `Shift Notes must be ${SHIFT_NOTES_MAX_LENGTH} characters or fewer.`;
  }

  if (row.internalComment.trim() && row.internalComment.length > INTERNAL_COMMENT_MAX_LENGTH) {
    errors.internalComment = `Internal comment must be ${INTERNAL_COMMENT_MAX_LENGTH} characters or fewer.`;
  }

  return errors;
}

export function validateBatchDraftRows(
  centreId: string,
  rows: BatchDraftShift[],
): { rowErrors: BatchDraftFieldErrors[]; formError?: string } {
  if (!centreId) {
    return { rowErrors: rows.map(() => ({})), formError: "Please select a centre." };
  }
  if (!rows.length) {
    return { rowErrors: [], formError: "Add at least one shift." };
  }

  const rowErrors = rows.map((row) => validateBatchDraftRow(row));
  const hasErrors = rowErrors.some((errors) => Object.keys(errors).length > 0);
  if (hasErrors) {
    return { rowErrors, formError: "Fix the highlighted shifts before submitting." };
  }

  return { rowErrors };
}

export function formatBatchTimeForApi(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

export function parseBulkCreateError(details?: Record<string, unknown>): { index?: number; detail?: string } {
  if (!details) return {};
  const nested =
    details.message && typeof details.message === "object"
      ? (details.message as Record<string, unknown>)
      : details;
  const index = typeof nested.index === "number" ? nested.index : undefined;
  const detail =
    typeof nested.detail === "string"
      ? nested.detail
      : typeof details.detail === "string"
        ? details.detail
        : undefined;
  return { index, detail };
}

export function computeBatchProgress(shifts: ShiftBatchChildSummary[]): BatchProgressSummary {
  const cancelledCount = shifts.filter((shift) => shift.status === "cancelled").length;
  const active = shifts.filter((shift) => shift.status !== "cancelled");
  const fulfilledCount = active.filter(
    (shift) => shift.status === "filled" || shift.status === "completed",
  ).length;

  return {
    activeTotal: active.length,
    fulfilledCount,
    cancelledCount,
    percentage: active.length ? Math.round((fulfilledCount / active.length) * 100) : 0,
  };
}

export function deriveBatchDisplayState(
  requestCompletedAt: string | null,
  progress: BatchProgressSummary,
  options?: {
    confirmationUiState?: BatchConfirmationUiState | null;
    pendingChangeRevision?: number;
  },
): BatchDisplayState {
  if (options?.confirmationUiState) {
    return options.confirmationUiState;
  }
  if (requestCompletedAt) {
    if ((options?.pendingChangeRevision ?? 0) > 0) {
      if (progress.activeTotal > 0 && progress.fulfilledCount === progress.activeTotal) {
        return "ready_to_send_updates";
      }
      return "updates_required";
    }
    return "completed";
  }
  if (progress.activeTotal > 0 && progress.fulfilledCount === progress.activeTotal) return "ready";
  return "open";
}

export function formatBatchDateRange(shifts: ShiftBatchChildSummary[]): string | null {
  if (!shifts.length) return null;
  const dates = [...new Set(shifts.map((shift) => shift.shiftDate))].sort();
  if (dates.length === 1) return dates[0] ?? null;
  return `${dates[0]} – ${dates[dates.length - 1]}`;
}

export function batchChildAssigneeLabel(shift: ShiftBatchChildSummary): string | null {
  if (!shift.assignedStaffId || !shift.assignedLegalName) return null;
  if (shift.assignedUseDisplayName && shift.assignedDisplayName?.trim()) {
    return shift.assignedDisplayName.trim();
  }
  return shift.assignedLegalName;
}

export function canInlineEditBatchChild(status: ShiftStatus, assignedStaffId: string | null): boolean {
  void assignedStaffId;
  return status === "pending" || status === "filled";
}

export type IndividualShiftCreatePrefill = {
  centreId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  confirmationNotes: string;
  pendingInternalComment?: string;
};

export const INDIVIDUAL_SHIFT_CREATE_PREFILL_KEY = "individualShiftCreatePrefill";

export function batchDraftToIndividualPrefill(
  centreId: string,
  row: BatchDraftShift,
): IndividualShiftCreatePrefill {
  return {
    centreId,
    shiftDate: row.shiftDate,
    startTime: row.startTime,
    endTime: row.endTime,
    roleNeeded: row.roleNeeded,
    addedToStaffpoint: row.addedToStaffpoint,
    confirmationNotes: row.confirmationNotes,
    pendingInternalComment: row.internalComment.trim() || undefined,
  };
}

export function readIndividualShiftCreatePrefill(): IndividualShiftCreatePrefill | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(INDIVIDUAL_SHIFT_CREATE_PREFILL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IndividualShiftCreatePrefill;
  } catch {
    return null;
  }
}

export function writeIndividualShiftCreatePrefill(prefill: IndividualShiftCreatePrefill): void {
  sessionStorage.setItem(INDIVIDUAL_SHIFT_CREATE_PREFILL_KEY, JSON.stringify(prefill));
}

export function clearIndividualShiftCreatePrefill(): void {
  sessionStorage.removeItem(INDIVIDUAL_SHIFT_CREATE_PREFILL_KEY);
}
