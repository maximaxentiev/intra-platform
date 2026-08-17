import type {
  ShiftAssignmentNotificationsResult,
  ShiftAssignmentOutcome,
} from "@/lib/db";

export function shiftAssignmentFeedbackMessage(
  staffName: string,
  assignment: ShiftAssignmentOutcome,
  notifications: ShiftAssignmentNotificationsResult | null,
): string {
  if (assignment.alreadyAssigned) {
    return `${staffName} is already assigned to this shift.`;
  }

  if (!notifications) {
    return `${staffName} assigned.`;
  }

  const centre = notifications.centre;
  const carer = notifications.carer;

  const centreMissing =
    centre.skippedReason === "no_centre_primary_contact" ||
    centre.skippedReason === "no_centre_email";
  const centreFailed = centre.attempted && !centre.sent;
  const carerFailed = carer.attempted && !carer.sent;
  const carerSkipped = carer.skippedReason === "no_carer_email" || carer.skippedReason === "invalid_carer_email";

  if (centreMissing) {
    if (carer.sent) {
      return `${staffName} assigned. No centre primary contact email is configured.`;
    }
    if (carerFailed || carerSkipped) {
      return `${staffName} assigned. No centre primary contact email is configured.`;
    }
  }

  if (centre.sent && carer.sent) {
    return `${staffName} assigned. Confirmation emails sent.`;
  }

  if (centreFailed && carerFailed) {
    return `${staffName} assigned. Confirmation emails could not be sent.`;
  }

  if (centreFailed || centre.skippedReason === "document_share_unavailable") {
    return `${staffName} assigned. The centre confirmation email could not be sent.`;
  }

  if (carerFailed || carerSkipped) {
    return `${staffName} assigned. The carer confirmation email could not be sent.`;
  }

  return `${staffName} assigned. Confirmation emails sent.`;
}

export function shiftResendFeedbackMessage(
  notifications: ShiftAssignmentNotificationsResult,
): string {
  if (notifications.centre.sent && notifications.carer.sent) {
    return "Confirmation emails sent.";
  }
  if (
    (notifications.centre.attempted && !notifications.centre.sent) ||
    (notifications.carer.attempted && !notifications.carer.sent)
  ) {
    return "Some confirmation emails could not be sent.";
  }
  if (
    notifications.centre.skippedReason === "no_centre_primary_contact" ||
    notifications.centre.skippedReason === "no_centre_email"
  ) {
    return "No centre primary contact email is configured.";
  }
  return "Confirmation emails sent.";
}
