import { ApiError } from "@/lib/api";
import type { StaffDocumentType } from "@/lib/carer-documents";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

const blobCache = new Map<string, { url: string; refs: number }>();

export function staffDocumentContentCacheKey(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): string {
  return `${input.documentType}:${input.fileId}`;
}

export function staffDocumentContentPath(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): string {
  return `/staff-portal/documents/${input.documentType}/files/${input.fileId}/content`;
}

export function invalidateStaffDocumentBlob(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): void {
  const key = staffDocumentContentCacheKey(input);
  const entry = blobCache.get(key);
  if (!entry) return;
  URL.revokeObjectURL(entry.url);
  blobCache.delete(key);
}

export function releaseStaffDocumentBlob(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): void {
  const key = staffDocumentContentCacheKey(input);
  const entry = blobCache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    blobCache.delete(key);
  }
}

export async function acquireStaffDocumentBlobUrl(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): Promise<string> {
  const key = staffDocumentContentCacheKey(input);
  const cached = blobCache.get(key);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }

  const res = await fetch(`${API_URL}/api${staffDocumentContentPath(input)}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      if (payload.message) {
        message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  blobCache.set(key, { url, refs: 1 });
  return url;
}

/** Open a private staff document in a new browser tab using the carer session cookie. */
export async function openStaffDocumentFile(input: {
  documentType: StaffDocumentType;
  fileId: string;
}): Promise<void> {
  const url = await acquireStaffDocumentBlobUrl(input);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }
}

const opsBlobCache = new Map<string, { url: string; refs: number }>();

export function opsStaffDocumentContentCacheKey(input: {
  staffId: string;
  documentType: StaffDocumentType;
  fileId: string;
}): string {
  return `ops:${input.staffId}:${input.documentType}:${input.fileId}`;
}

export async function acquireOpsStaffDocumentBlobUrl(input: {
  staffId: string;
  documentType: StaffDocumentType;
  fileId: string;
}): Promise<string> {
  const key = opsStaffDocumentContentCacheKey(input);
  const cached = opsBlobCache.get(key);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }

  const path = `/staff/${input.staffId}/documents/${input.documentType}/files/${input.fileId}/content`;
  const res = await fetch(`${API_URL}/api${path}`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      if (payload.message) {
        message = Array.isArray(payload.message) ? payload.message.join(", ") : payload.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  opsBlobCache.set(key, { url, refs: 1 });
  return url;
}

export async function openOpsStaffDocumentFile(input: {
  staffId: string;
  documentType: StaffDocumentType;
  fileId: string;
}): Promise<void> {
  const url = await acquireOpsStaffDocumentBlobUrl(input);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  }
}

export async function downloadOpsStaffDocumentFile(input: {
  staffId: string;
  documentType: StaffDocumentType;
  fileId: string;
  filename: string;
}): Promise<void> {
  const url = await acquireOpsStaffDocumentBlobUrl(input);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.filename;
  anchor.rel = "noopener noreferrer";
  anchor.click();
}
