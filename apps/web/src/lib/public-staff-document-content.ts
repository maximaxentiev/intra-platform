import { ApiError } from "@/lib/api";
import {
  PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE,
  publicStaffDocumentContentPath,
  type PublicStaffDocumentShareDocument,
} from "@/lib/public-staff-document-share";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

const blobCache = new Map<string, { url: string; refs: number }>();

function cacheKey(documentType: PublicStaffDocumentShareDocument["documentType"], fileId: string) {
  return `public-share:${documentType}:${fileId}`;
}

export function releasePublicStaffDocumentBlob(input: {
  documentType: PublicStaffDocumentShareDocument["documentType"];
  fileId: string;
}): void {
  const key = cacheKey(input.documentType, input.fileId);
  const entry = blobCache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    blobCache.delete(key);
  }
}

export async function acquirePublicStaffDocumentBlobUrl(input: {
  documentType: PublicStaffDocumentShareDocument["documentType"];
  fileId: string;
}): Promise<string> {
  const key = cacheKey(input.documentType, input.fileId);
  const cached = blobCache.get(key);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }

  const path = publicStaffDocumentContentPath(input.documentType, input.fileId);
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new ApiError(res.status, PUBLIC_SHARE_FILE_OPEN_ERROR_MESSAGE);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  blobCache.set(key, { url, refs: 1 });
  return url;
}

export async function openPublicStaffDocumentFile(input: {
  documentType: PublicStaffDocumentShareDocument["documentType"];
  fileId: string;
}): Promise<void> {
  const url = await acquirePublicStaffDocumentBlobUrl(input);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }
}
