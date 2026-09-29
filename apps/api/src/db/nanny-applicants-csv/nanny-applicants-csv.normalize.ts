const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function trimToNull(value: string | undefined | null): string | null {
  if (value === undefined || value === null) return null;
  const t = value.trim();
  return t ? t : null;
}

export function normalizeYesNo(value: string | null): boolean | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === 'yes' || v === 'true') return true;
  if (v === 'no' || v === 'false') return false;
  return null;
}

export function normalizeEmail(value: string | null): { email: string | null; malformed: boolean } {
  if (!value) return { email: null, malformed: false };
  const e = value.trim().toLowerCase();
  if (!e) return { email: null, malformed: false };
  if (!EMAIL_RE.test(e)) return { email: null, malformed: true };
  return { email: e, malformed: false };
}

export function isValidCsvId(value: string | null): boolean {
  return !!value && UUID_RE.test(value.trim());
}

export function parseMultiSelect(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeDate(value: string | null): { date: string | null; invalid: boolean } {
  const t = trimToNull(value);
  if (!t) return { date: null, invalid: false };
  if (DATE_RE.test(t)) return { date: t, invalid: false };
  const parsed = Date.parse(t);
  if (Number.isNaN(parsed)) return { date: null, invalid: true };
  const d = new Date(parsed);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return { date: iso, invalid: false };
}

export function normalizeSpokenEnglish(value: string | null): {
  rating: number | null;
  invalid: boolean;
} {
  const t = trimToNull(value);
  if (!t) return { rating: null, invalid: false };
  const n = Number.parseInt(t, 10);
  if (!Number.isInteger(n) || n < 1 || n > 10) return { rating: null, invalid: true };
  return { rating: n, invalid: false };
}

export type DocumentReferenceKind =
  | 'empty'
  | 'https_url'
  | 'non_https_url'
  | 'object_object'
  | 'other';

export function classifyDocumentReference(value: string | null): DocumentReferenceKind {
  const t = trimToNull(value);
  if (!t) return 'empty';
  if (t === '[object Object]') return 'object_object';
  if (/^https:\/\//i.test(t)) return 'https_url';
  if (/^http:\/\//i.test(t)) return 'non_https_url';
  return 'other';
}

export function extractFilenameFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    if (!segment) return null;
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
