import type { ShiftAssignmentRecipientResult } from "@/lib/db";

export type ShiftUpdateCommunicationsResult = {
  centre: ShiftAssignmentRecipientResult | null;
  carer: ShiftAssignmentRecipientResult | null;
} | null;

export function shiftUpdateFeedbackMessage(communications: ShiftUpdateCommunicationsResult): string {
  if (!communications) {
    return "Shift updated.";
  }

  const centre = communications.centre;
  const carer = communications.carer;

  if (!centre && !carer) {
    return "Shift updated.";
  }

  const centreSent = centre?.sent === true;
  const carerSent = carer?.sent === true;
  const centreAttempted = centre?.attempted === true;
  const carerAttempted = carer?.attempted === true;

  if (centreSent && carerSent) {
    return "Shift updated. Centre and Carer emails sent.";
  }

  if (centreSent && !carer) {
    return "Shift updated. Centre email sent.";
  }

  if (carerSent && !centre) {
    return "Shift updated. Carer email sent.";
  }

  if (centreSent && carerAttempted && !carerSent) {
    return "Shift updated. Centre email sent. Carer email could not be sent.";
  }

  if (carerSent && centreAttempted && !centreSent) {
    return "Shift updated. Carer email sent. Centre email could not be sent.";
  }

  if (centreAttempted && carerAttempted && !centreSent && !carerSent) {
    return "Shift updated. Emails could not be sent.";
  }

  if (centreAttempted && !centreSent) {
    return "Shift updated. Centre email could not be sent.";
  }

  if (carerAttempted && !carerSent) {
    return "Shift updated. Carer email could not be sent.";
  }

  return "Shift updated.";
}
