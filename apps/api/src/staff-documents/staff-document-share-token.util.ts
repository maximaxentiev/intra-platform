import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { STAFF_DOCUMENT_SHARE_TOKEN_DOMAIN } from './staff-document-share.constants';
import { shareTokenRotationEpoch } from './staff-document-share-epoch.util';

export function buildStaffDocumentShareTokenMessage(
  staffId: string,
  rotationEpoch: number,
): string {
  return `${STAFF_DOCUMENT_SHARE_TOKEN_DOMAIN}:${staffId}:${rotationEpoch}`;
}

/** Derive the server-reconstructable share token (base64url HMAC-SHA256, 256 bits). */
export function deriveStaffDocumentShareToken(
  signingSecret: string,
  staffId: string,
  createdAt: Date,
): string {
  const rotationEpoch = shareTokenRotationEpoch(createdAt);
  const message = buildStaffDocumentShareTokenMessage(staffId, rotationEpoch);
  return createHmac('sha256', signingSecret).update(message).digest('base64url');
}

/** SHA-256 hex digest of the raw derived token — persisted as document_share_token_hash. */
export function hashStaffDocumentShareToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length !== 64 || !/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function verifyStaffDocumentShareTokenHash(
  providedToken: string,
  storedHash: string | null | undefined,
): boolean {
  if (!storedHash) {
    return false;
  }
  const providedHash = hashStaffDocumentShareToken(providedToken);
  return timingSafeEqualHex(providedHash, storedHash);
}

/**
 * Verify a provided share token against staff share state.
 * Requires active-state fields (hash + created_at); caller must check revocation separately.
 */
export function verifyStaffDocumentShareToken(
  signingSecret: string,
  staffId: string,
  createdAt: Date,
  providedToken: string,
  storedHash: string,
): boolean {
  if (!verifyStaffDocumentShareTokenHash(providedToken, storedHash)) {
    return false;
  }
  const expectedToken = deriveStaffDocumentShareToken(signingSecret, staffId, createdAt);
  const expectedHash = hashStaffDocumentShareToken(expectedToken);
  const providedHash = hashStaffDocumentShareToken(providedToken);
  return timingSafeEqualHex(providedHash, expectedHash);
}
