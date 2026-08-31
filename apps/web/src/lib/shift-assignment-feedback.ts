import type {
  ShiftAssignmentNotificationsResult,
  ShiftAssignmentOutcome,
} from "@/lib/db";

const DEFERRED_BATCH_REASON = "deferred_batch_confirmation";

function centreWasDeferred(notifications: ShiftAssignmentNotificationsResult): boolean {
  return (
    notifications.centre.deferred === true ||
    notifications.centre.skippedReason === DEFERRED_BATCH_REASON
  );
}

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
  const centreDeferred = centreWasDeferred(notifications);

  const centreMissing =
    centre.skippedReason === "no_centre_primary_contact" ||
    centre.skippedReason === "no_centre_email";
  const centreFailed = centre.attempted && !centre.sent && !centreDeferred;
  const carerFailed = carer.attempted && !carer.sent;
  const carerSkipped =
    carer.skippedReason === "no_carer_email" || carer.skippedReason === "invalid_carer_email";

  if (centreDeferred && carer.sent) {
    return `${staffName} assigned. Carer confirmation sent. Centre confirmation is managed through this Batch Request.`;
  }

  if (centreDeferred && !carer.sent && !carerFailed && !carerSkipped) {
    return `${staffName} assigned. Centre confirmation is managed through this Batch Request.`;
  }

  if (centreDeferred && (carerFailed || carerSkipped)) {
    return `${staffName} assigned. Centre confirmation is managed through this Batch Request. The carer confirmation email could not be sent.`;
  }

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
  const centreSent = notifications.centre.sent;
  const carerSent = notifications.carer.sent;
  const centreAttempted = notifications.centre.attempted;
  const carerAttempted = notifications.carer.attempted;
  const centreDeferred = centreWasDeferred(notifications);

  if (centreDeferred && carerSent) {
    return "Carer confirmation email sent. Centre confirmation is managed through this Batch Request.";
  }

  if (centreSent && carerSent) {
    return "Confirmation emails sent.";
  }
  if (centreSent && !carerAttempted) {
    return "Centre confirmation email sent.";
  }
  if (carerSent && !centreAttempted) {
    return "Carer confirmation email sent.";
  }
  if (
    (centreAttempted && !centreSent && !centreDeferred) ||
    (carerAttempted && !carerSent)
  ) {
    return "Some confirmation emails could not be sent.";
  }
  return "Confirmation emails sent.";
}

export function shiftUnassignFeedbackMessage(
  notifications: ShiftAssignmentNotificationsResult | null,
): string {
  if (!notifications) {
    return "Carer unassigned.";
  }
  const centreSent = notifications.centre?.sent;
  const carerSent = notifications.carer?.sent;
  const centreAttempted = notifications.centre?.attempted;
  const carerAttempted = notifications.carer?.attempted;
  const centreDeferred = notifications.centre
    ? centreWasDeferred({
        centre: notifications.centre,
        carer: notifications.carer ?? { attempted: false, sent: false },
      })
    : false;

  if (centreDeferred && carerSent) {
    return "Carer unassigned. Carer notified. Centre communication is managed through this Batch Request.";
  }

  if (centreSent && carerSent) {
    return "Carer unassigned. Communication sent.";
  }
  if (centreSent && !carerAttempted) {
    return "Carer unassigned. Centre notified.";
  }
  if (carerSent && !centreAttempted) {
    return "Carer unassigned. Carer notified.";
  }
  if (
    (centreAttempted && !centreSent && !centreDeferred) ||
    (carerAttempted && !carerSent)
  ) {
    return "Carer unassigned. Some communication could not be sent.";
  }
  return "Carer unassigned.";
}
