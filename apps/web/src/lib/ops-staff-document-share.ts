import { api } from "@/lib/api";

export type StaffDocumentShareState = "none" | "active" | "revoked";

export type StaffDocumentShareStatus = {
  state: StaffDocumentShareState;
  slug: string | null;
  createdAt: string | null;
  revokedAt: string | null;
  canCopy: boolean;
};

export type StaffDocumentShareUrlResponse = {
  shareUrl: string;
};

function shareBase(staffId: string): string {
  return `/staff/${staffId}/documents/share`;
}

export const opsStaffDocumentShareApi = {
  getStatus(staffId: string): Promise<StaffDocumentShareStatus> {
    return api.get<StaffDocumentShareStatus>(shareBase(staffId));
  },

  generate(staffId: string): Promise<StaffDocumentShareUrlResponse> {
    return api.post<StaffDocumentShareUrlResponse>(`${shareBase(staffId)}/generate`);
  },

  copyLink(staffId: string): Promise<StaffDocumentShareUrlResponse> {
    return api.post<StaffDocumentShareUrlResponse>(`${shareBase(staffId)}/copy-link`);
  },

  rotate(staffId: string): Promise<StaffDocumentShareUrlResponse> {
    return api.post<StaffDocumentShareUrlResponse>(`${shareBase(staffId)}/rotate`);
  },

  revoke(staffId: string): Promise<StaffDocumentShareStatus> {
    return api.post<StaffDocumentShareStatus>(`${shareBase(staffId)}/revoke`);
  },
};

export const STAFF_DOCUMENT_SHARE_POLICY =
  "Shares the staff member's current approved documents. Vulnerable Sector Check, First Aid & CPR and Immunizations are included when approved. COVID-19 Vaccination is included only when it is on file and approved.";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
