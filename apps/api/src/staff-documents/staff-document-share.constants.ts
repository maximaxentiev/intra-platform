/**
 * Shareable staff document page — schema foundation only (Phase 3A).
 *
 * Authorization model (implemented in Phase 3I):
 * - `staff.document_slug` is cosmetic in URLs (/documents/{slug}/{token}).
 * - Only `staff.document_share_token_hash` (SHA-256) is stored — never the raw token.
 * - Issuing/rotating a new token replaces the stored hash and clears `document_share_token_revoked_at`.
 * - Revocation sets `document_share_token_revoked_at`; possession of the previously issued raw token must fail.
 * - Slug alone must never grant access.
 *
 * Default public visibility when sharing is implemented:
 * - VSC + First Aid may be included.
 * - Immunizations + COVID remain private unless product explicitly approves otherwise
 *   (see STAFF_DOCUMENT_DEFAULT_PUBLIC_SHARE).
 */

export const STAFF_DOCUMENT_SHARE_TOKEN_BYTES = 32;
