/**
 * Shareable staff document page — Phase 3I security foundation.
 *
 * Authorization model:
 * - `staff.document_slug` is cosmetic in URLs (/documents/{slug}#{token}).
 * - Only `staff.document_share_token_hash` (SHA-256) is stored — never the raw token.
 * - HMAC-derived token from staffId + document_share_token_created_at (rotation epoch).
 * - Issuing/rotating replaces hash + created_at and clears document_share_token_revoked_at.
 * - Revocation sets document_share_token_revoked_at; possession of the token must fail.
 * - Slug alone must never grant access.
 *
 * Default public visibility:
 * - All four categories may appear when approved/current (see STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE).
 * - COVID inclusion on the public page does not affect compliance or shift eligibility.
 */

/** Domain separation prefix for long-lived share token HMAC. */
export const STAFF_DOCUMENT_SHARE_TOKEN_DOMAIN = 'staff-document-share-token:v1';

/** Domain separation prefix for short-lived share session HMAC. */
export const STAFF_DOCUMENT_SHARE_SESSION_DOMAIN = 'staff-document-share-session:v1';

export const STAFF_DOCUMENT_SHARE_SESSION_VERSION = 1 as const;

/** Share session lifetime in seconds — 30 minutes. */
export const STAFF_DOCUMENT_SHARE_SESSION_TTL_SECONDS = 30 * 60;

/** Share session lifetime in milliseconds — signed payload exp validation. */
export const STAFF_DOCUMENT_SHARE_SESSION_TTL_MS =
  STAFF_DOCUMENT_SHARE_SESSION_TTL_SECONDS * 1000;

/** Express res.cookie maxAge — milliseconds (must match signed session TTL). */
export const STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS =
  STAFF_DOCUMENT_SHARE_SESSION_TTL_MS;

/** Cookie name for future public share session (set in Phase 3I-C). */
export const STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME = 'intra_staff_share';

/** Narrow cookie path scoped to future public share API routes. */
export const STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH = '/api/v1/public/staff-documents/share';

/** Minimum DOCUMENT_SHARE_SIGNING_SECRET length (characters). */
export const STAFF_DOCUMENT_SHARE_SIGNING_SECRET_MIN_LENGTH = 32;

/** Maximum cosmetic slug length after normalization. */
export const STAFF_DOCUMENT_SLUG_MAX_LENGTH = 80;
