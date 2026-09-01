export type ShiftAssignmentRecipientResult = {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
  /** Centre communication intentionally deferred (open Batch Request). Not a failure. */
  deferred?: boolean;
};

export type ShiftAssignmentNotificationsResult = {
  centre: ShiftAssignmentRecipientResult;
  carer: ShiftAssignmentRecipientResult;
};

export type ShiftAssignmentOutcome = {
  changed: boolean;
  alreadyAssigned: boolean;
};

export type ShiftAssignResponse = {
  shift: Record<string, unknown>;
  assignment: ShiftAssignmentOutcome;
  notifications: ShiftAssignmentNotificationsResult | null;
  previousCarerNotification?: ShiftAssignmentRecipientResult | null;
};

export type ShiftResendConfirmationsResponse = {
  notifications: ShiftAssignmentNotificationsResult;
};

export type UnassignShiftResponse = {
  shift: Record<string, unknown>;
  notifications: {
    centre: ShiftAssignmentRecipientResult | null;
    carer: ShiftAssignmentRecipientResult | null;
  } | null;
};
