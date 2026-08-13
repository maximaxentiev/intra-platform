import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';

const LOGGER = new Logger('PublicShareFileAuthDiag');

export type PublicShareAuthPhase = 'metadata' | 'file_stream';

export type PublicShareFileAuthReason =
  | 'share_session_missing'
  | 'share_session_invalid'
  | 'staff_not_found'
  | 'share_inactive'
  | 'share_epoch_mismatch'
  | 'document_type_invalid'
  | 'document_type_not_public'
  | 'category_missing'
  | 'category_not_shareable'
  | 'file_not_in_snapshot'
  | 'file_submission_mismatch'
  | 'storage_stream_failed'
  | 'file_stream_authorized';

export function hashPublicShareDiagId(value: string | null | undefined): string {
  if (!value || typeof value !== 'string') {
    return 'none';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 'none';
  }
  return createHash('sha256').update(trimmed).digest('hex').slice(0, 8);
}

export function logPublicShareFileAuthDecision(
  phase: PublicShareAuthPhase,
  reason: PublicShareFileAuthReason,
  details: Record<string, unknown> = {},
): void {
  LOGGER.warn(
    JSON.stringify({
      tag: 'public_share_file_auth',
      phase,
      reason,
      ...details,
    }),
  );
}

/** RFC 6265 path-prefix match: request path must start with the cookie Path. */
export function isRequestPathWithinShareSessionCookiePath(
  requestPath: string,
  cookiePath: string,
): boolean {
  if (!requestPath.startsWith('/')) {
    return false;
  }
  if (requestPath === cookiePath) {
    return true;
  }
  if (!requestPath.startsWith(cookiePath)) {
    return false;
  }
  const nextChar = requestPath.charAt(cookiePath.length);
  return nextChar === '/' || nextChar === '';
}
