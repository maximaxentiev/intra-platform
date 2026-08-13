import { shareTokenRotationEpochFromPersisted } from './staff-document-share-epoch.util';

export type StaffDocumentShareTokenState = 'none' | 'active' | 'revoked';

/** Staff columns involved in document share authorization. */
export interface StaffDocumentShareFields {
  documentShareTokenHash: string | null;
  documentShareTokenCreatedAt: Date | null;
  documentShareTokenRevokedAt: Date | null;
}

export function resolveStaffDocumentShareTokenState(
  fields: StaffDocumentShareFields,
): StaffDocumentShareTokenState {
  if (!fields.documentShareTokenHash || !fields.documentShareTokenCreatedAt) {
    return 'none';
  }
  if (fields.documentShareTokenRevokedAt) {
    return 'revoked';
  }
  return 'active';
}

export function isStaffDocumentShareTokenActive(fields: StaffDocumentShareFields): boolean {
  return resolveStaffDocumentShareTokenState(fields) === 'active';
}

/** DB update shape for a newly generated or rotated share link. */
export interface StaffDocumentShareTokenPersistValues {
  documentShareTokenHash: string;
  documentShareTokenCreatedAt: Date;
  documentShareTokenRevokedAt: null;
}

/** DB update shape for revoking an active share link. */
export interface StaffDocumentShareTokenRevokeValues {
  documentShareTokenRevokedAt: Date;
}

export function buildShareTokenPersistValues(input: {
  createdAt: Date;
  hash: string;
}): StaffDocumentShareTokenPersistValues {
  return {
    documentShareTokenHash: input.hash,
    documentShareTokenCreatedAt: input.createdAt,
    documentShareTokenRevokedAt: null,
  };
}

export function buildShareTokenRevokeValues(revokedAt: Date = new Date()): StaffDocumentShareTokenRevokeValues {
  return { documentShareTokenRevokedAt: revokedAt };
}

/**
 * Validates a signed share session against live Staff share state.
 * Future endpoints must call this on every sensitive request.
 */
export function assertShareSessionMatchesStaffShareState(input: {
  sessionStaffId: string;
  sessionTokenIssuedAt: number;
  staffId: string;
  shareFields: StaffDocumentShareFields;
}): boolean {
  if (input.sessionStaffId !== input.staffId) {
    return false;
  }
  if (!isStaffDocumentShareTokenActive(input.shareFields)) {
    return false;
  }
  const rotationEpoch = shareTokenRotationEpochFromPersisted(
    input.shareFields.documentShareTokenCreatedAt,
  );
  return rotationEpoch !== null && input.sessionTokenIssuedAt === rotationEpoch;
}
