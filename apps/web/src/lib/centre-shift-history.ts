const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

function buildUrl(path: string, query?: Record<string, string>): string {
  const url = `${API_URL}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? null;
}

export type CentreShiftHistoryPreview = {
  centreId: string;
  centreName: string;
  dateFrom: string;
  dateTo: string;
  shiftCount: number;
  recipient: { name: string; email: string } | null;
  canSendEmail: boolean;
  canDownloadCsv: boolean;
  emptyMessage: string | null;
  missingPrimaryContactMessage: string | null;
};

export async function fetchCentreShiftHistoryPreview(
  centreId: string,
  dateFrom: string,
  dateTo: string,
): Promise<CentreShiftHistoryPreview> {
  const res = await fetch(
    buildUrl(`/centres/${centreId}/shift-history/preview`, { dateFrom, dateTo }),
    { credentials: "include" },
  );
  if (!res.ok) {
    let message = "Could not load shift history preview.";
    try {
      const payload = await res.json();
      if (payload && typeof payload === "object" && "message" in payload) {
        const raw = (payload as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join(", ") : String(raw);
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return res.json() as Promise<CentreShiftHistoryPreview>;
}

export async function downloadCentreShiftHistoryCsv(
  centreId: string,
  dateFrom: string,
  dateTo: string,
): Promise<void> {
  const res = await fetch(
    buildUrl(`/centres/${centreId}/shift-history/export`, { dateFrom, dateTo }),
    { credentials: "include" },
  );
  if (!res.ok) {
    let message = "Could not download shift history CSV.";
    try {
      const payload = await res.json();
      if (payload && typeof payload === "object" && "message" in payload) {
        const raw = (payload as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join(", ") : String(raw);
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ?? "centre-shift-history.csv";
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function sendCentreShiftHistoryEmail(
  centreId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{ scheduledCommunicationId: string; shiftCount: number }> {
  const res = await fetch(buildUrl(`/centres/${centreId}/shift-history/email`), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dateFrom, dateTo }),
  });
  if (!res.ok) {
    let message = "Could not send shift history email.";
    try {
      const payload = await res.json();
      if (payload && typeof payload === "object" && "message" in payload) {
        const raw = (payload as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join(", ") : String(raw);
      }
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return res.json() as Promise<{ scheduledCommunicationId: string; shiftCount: number }>;
}
