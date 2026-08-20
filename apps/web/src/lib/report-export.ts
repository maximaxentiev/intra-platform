const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

type ExportQuery = Record<string, string | number | boolean | undefined | null | string[]>;

function buildExportUrl(path: string, query?: ExportQuery): string {
  const url = `${API_URL}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" || key === "pageSize") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] ?? null;
}

export async function downloadReportCsv(path: string, query?: ExportQuery): Promise<void> {
  const res = await fetch(buildExportUrl(path, query), {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    let message = "Could not export this report. Please try again.";
    try {
      const payload = await res.json();
      if (payload && typeof payload === "object" && "message" in payload) {
        const raw = (payload as { message: unknown }).message;
        message = Array.isArray(raw) ? raw.join(", ") : String(raw);
      }
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename =
    parseFilename(res.headers.get("Content-Disposition")) ??
    path.split("/").pop()?.replace("/export", "") ??
    "report.csv";

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

export const reportExportPaths = {
  shiftFulfillment: "/reports/shift-fulfillment/export",
  centreUsage: "/reports/centre-usage/export",
  staffUsage: "/reports/staff-usage/export",
  documentCompliance: "/reports/documents/export",
  activityLog: "/reports/activity/export",
} as const;
