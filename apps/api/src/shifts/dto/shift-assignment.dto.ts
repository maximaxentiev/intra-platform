export type ShiftAssignmentRecipientResult = {
  attempted: boolean;
  sent: boolean;
  skippedReason?: string;
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
};

export type ShiftResendConfirmationsResponse = {
  notifications: ShiftAssignmentNotificationsResult;
};
