// Typed fetch client for the Intra API (NestJS). Cookie-based session auth:
// every request sends credentials so the httpOnly session cookie is included.
const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_URL}/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      params.set(k, v.join(","));
      continue;
    }
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const res = await fetch(buildUrl(path, query), {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? Array.isArray((payload as { message: unknown }).message)
          ? ((payload as { message: string[] }).message.join(", "))
          : String((payload as { message: unknown }).message)
        : undefined) ?? `Request failed (${res.status})`;
    const details =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined;
    throw new ApiError(res.status, message, details);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
  postForm: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(buildUrl(path), {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const text = await res.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "message" in payload
          ? Array.isArray((payload as { message: unknown }).message)
            ? (payload as { message: string[] }).message.join(", ")
            : String((payload as { message: unknown }).message)
          : `Request failed (${res.status})`;
      const details =
        payload && typeof payload === "object" ? (payload as Record<string, unknown>) : undefined;
      throw new ApiError(res.status, message, details);
    }
    return payload as T;
  },
};
