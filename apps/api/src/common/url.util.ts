/**
 * Validates that a user-supplied URL is a safe http(s) link (closes M2).
 * Empty string is allowed (optional field). Anything else must parse as a
 * http/https absolute URL. Returns the normalized string or throws.
 */
export function sanitizeOptionalHttpUrl(value: unknown): string {
  if (value === undefined || value === null) return '';
  const raw = String(value).trim();
  if (raw === '') return '';

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('documents_url must be a valid http(s) URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('documents_url must use http or https.');
  }
  return parsed.toString();
}
