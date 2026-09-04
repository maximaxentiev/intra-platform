import { api } from "@/lib/api";

export type CentreEmailRecipient = {
  name: string;
  email: string;
};

export type CentreEmailCustomContent = {
  subject?: string;
  message?: string;
};

export type CentreEmailPreview = {
  recipient: CentreEmailRecipient | null;
  subject: string;
  message: string;
  defaultSubject: string;
  defaultMessage: string;
  html: string;
  text: string;
  pendingChangeRevision?: number;
};

export async function previewShiftAssignmentCentreEmail(
  shiftId: string,
  staffId: string,
  centreEmail?: CentreEmailCustomContent,
): Promise<CentreEmailPreview> {
  return api.post<CentreEmailPreview>(`/shifts/${shiftId}/centre-email-preview/assignment`, {
    staffId,
    centreEmail,
  });
}

export async function previewShiftUpdateCentreEmail(
  shiftId: string,
  payload: {
    includedChangeFields?: string[];
    centreEmail?: CentreEmailCustomContent;
    shiftDate?: string;
    startTime?: string;
    endTime?: string;
    roleNeeded?: string;
  },
): Promise<CentreEmailPreview> {
  return api.post<CentreEmailPreview>(`/shifts/${shiftId}/centre-email-preview/update`, payload);
}

export async function previewBatchCentreEmail(
  batchId: string,
  payload: {
    variant: "final" | "update";
    selectedChangeIds?: string[];
    centreEmail?: CentreEmailCustomContent;
  },
): Promise<CentreEmailPreview> {
  return api.post<CentreEmailPreview>(`/shift-batches/${batchId}/centre-email-preview`, payload);
}
