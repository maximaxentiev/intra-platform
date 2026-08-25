import { api, ApiError } from "@/lib/api";

export const PUBLIC_SHARE_UNAVAILABLE_MESSAGE =
  "This shared document page is not available.";

export const PUBLIC_SHARE_EMPTY_MESSAGE =
  "No current documents are available to view.";

export const PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE = "This document could not be opened.";

export type PublicStaffDocumentShareStaff = {
  displayName: string;
  role: string;
};

export type PublicStaffDocumentShareFile = {
  id: string;
  originalFilename: string;
  contentType: string;
};

export type PublicStaffDocumentShareDocumentType =
  | "vulnerable_sector_check"
  | "first_aid_cpr"
  | "immunizations"
  | "covid19_vaccination"
  | "eca_diploma"
  | "ece_diploma"
  | "rece_proof";

export type PublicStaffDocumentShareDocument = {
  documentType: PublicStaffDocumentShareDocumentType;
  label: string;
  processedDate: string | null;
  expiryDate: string | null;
  expiryDisplay: "current" | "expiring_soon" | "no_expiry";
  files: PublicStaffDocumentShareFile[];
};

export type PublicStaffDocumentShareMetadata = {
  staff: PublicStaffDocumentShareStaff;
  documents: PublicStaffDocumentShareDocument[];
};

const PUBLIC_SHARE_BASE = "/v1/public/staff-documents/share";

export function publicStaffDocumentContentPath(
  documentType: PublicStaffDocumentShareDocument["documentType"],
  fileId: string,
): string {
  return `${PUBLIC_SHARE_BASE}/${documentType}/files/${fileId}/content`;
}

export async function exchangeShareSession(slug: string, token: string): Promise<void> {
  await api.post<{ ok: true }>(`${PUBLIC_SHARE_BASE}/session`, { slug, token });
}

export async function getPublicStaffDocuments(): Promise<PublicStaffDocumentShareMetadata> {
  return api.get<PublicStaffDocumentShareMetadata>(PUBLIC_SHARE_BASE);
}

export function isPublicShareUnavailableError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** Read a raw share token from the URL fragment without the leading `#`. */
export function parseShareTokenFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const token = raw.trim();
  return token.length > 0 ? token : null;
}

/** Remove the fragment from the visible URL while preserving path and query. */
export function removeShareTokenFromBrowserUrl(): void {
  if (typeof window === "undefined") return;
  const nextUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

export type PublicSharePageLoadResult =
  | { status: "unavailable" }
  | { status: "empty"; metadata: PublicStaffDocumentShareMetadata }
  | { status: "available"; metadata: PublicStaffDocumentShareMetadata }
  | { status: "error" };

/** Testable load orchestration for the public share page. */
export async function loadPublicSharePage(input: {
  slug: string;
  hash: string;
  exchange: (slug: string, token: string) => Promise<void>;
  getMetadata: () => Promise<PublicStaffDocumentShareMetadata>;
}): Promise<PublicSharePageLoadResult> {
  const tokenFromHash = parseShareTokenFromHash(input.hash);
  if (tokenFromHash) {
    try {
      await input.exchange(input.slug, tokenFromHash);
    } catch {
      return { status: "unavailable" };
    }
  }

  try {
    const metadata = await input.getMetadata();
    return metadata.documents.length === 0
      ? { status: "empty", metadata }
      : { status: "available", metadata };
  } catch (err) {
    return isPublicShareUnavailableError(err) ? { status: "unavailable" } : { status: "error" };
  }
}
