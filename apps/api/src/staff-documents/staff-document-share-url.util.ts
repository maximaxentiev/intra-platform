import { normalizePublicUrl } from '../config/platform-url';

/** Build the public staff document share URL with token in the fragment (never query/path). */
export function buildStaffDocumentShareUrl(
  publicBaseUrl: string,
  slug: string,
  rawToken: string,
): string {
  const base = normalizePublicUrl(publicBaseUrl);
  const encodedSlug = encodeURIComponent(slug);
  return `${base}/documents/${encodedSlug}#${rawToken}`;
}
