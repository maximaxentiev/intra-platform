import { ApiError } from "@/lib/api";
import type { ApplicationDocument } from "@/lib/applications";

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

const blobCache = new Map<string, { url: string; refs: number }>();

export function documentContentCacheKey(doc: Pick<ApplicationDocument, "applicationId" | "id">): string {
  return `${doc.applicationId}:${doc.id}`;
}

export function documentContentPath(doc: Pick<ApplicationDocument, "applicationId" | "id">): string {
  return `/applications/${doc.applicationId}/documents/${doc.id}/content`;
}

export function invalidateDocumentBlob(doc: Pick<ApplicationDocument, "applicationId" | "id">): void {
  const key = documentContentCacheKey(doc);
  const entry = blobCache.get(key);
  if (!entry) return;
  URL.revokeObjectURL(entry.url);
  blobCache.delete(key);
}

export function releaseDocumentBlob(doc: Pick<ApplicationDocument, "applicationId" | "id">): void {
  const key = documentContentCacheKey(doc);
  const entry = blobCache.get(key);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    URL.revokeObjectURL(entry.url);
    blobCache.delete(key);
  }
}

/** Fetch (or reuse) a session-authenticated blob URL for a private application document. */
export async function acquireDocumentBlobUrl(
  doc: Pick<ApplicationDocument, "applicationId" | "id">,
): Promise<string> {
  const key = documentContentCacheKey(doc);
  const cached = blobCache.get(key);
  if (cached) {
    cached.refs += 1;
    return cached.url;
  }

  const res = await fetch(`${API_URL}/api${documentContentPath(doc)}`, {
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
