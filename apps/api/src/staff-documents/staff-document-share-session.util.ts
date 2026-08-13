import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CookieOptions } from 'express';
import {
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS,
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
  STAFF_DOCUMENT_SHARE_SESSION_DOMAIN,
  STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
  STAFF_DOCUMENT_SHARE_SESSION_VERSION,
} from './staff-document-share.constants';

export interface StaffDocumentShareSessionPayload {
  v: typeof STAFF_DOCUMENT_SHARE_SESSION_VERSION;
  staffId: string;
  tokenIssuedAt: number;
  exp: number;
}

export interface StaffDocumentShareSessionCookieConfig {
  secure: boolean;
}

export function signStaffDocumentShareSession(
  signingSecret: string,
  input: { staffId: string; tokenIssuedAt: number; nowMs?: number },
): string {
  const nowMs = input.nowMs ?? Date.now();
  const payload: StaffDocumentShareSessionPayload = {
    v: STAFF_DOCUMENT_SHARE_SESSION_VERSION,
    staffId: input.staffId,
    tokenIssuedAt: input.tokenIssuedAt,
    exp: nowMs + STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createStaffDocumentShareSessionSignature(signingSecret, payloadSegment);
  return `${payloadSegment}.${signature}`;
}

export function verifyStaffDocumentShareSession(
  signingSecret: string,
  sessionValue: string,
  nowMs: number = Date.now(),
): StaffDocumentShareSessionPayload | null {
  if (!sessionValue || typeof sessionValue !== 'string') {
    return null;
  }

  const separatorIndex = sessionValue.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex === sessionValue.length - 1) {
    return null;
  }

  const payloadSegment = sessionValue.slice(0, separatorIndex);
  const providedSignature = sessionValue.slice(separatorIndex + 1);
  const expectedSignature = createStaffDocumentShareSessionSignature(signingSecret, payloadSegment);

  if (!timingSafeEqualBase64Url(providedSignature, expectedSignature)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!isShareSessionPayload(payload)) {
    return null;
  }

  if (payload.v !== STAFF_DOCUMENT_SHARE_SESSION_VERSION) {
    return null;
  }

  if (nowMs >= payload.exp) {
    return null;
  }

  return payload;
}

export function staffDocumentShareSessionCookieOptions(
  config: StaffDocumentShareSessionCookieConfig,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax',
    path: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
    maxAge: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS,
  };
}

export function staffDocumentShareSessionCookieName(): string {
  return STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME;
}

export function clearStaffDocumentShareSessionCookieOptions(
  config: StaffDocumentShareSessionCookieConfig,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.secure,
    sameSite: 'lax',
    path: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
    maxAge: 0,
  };
}

function createStaffDocumentShareSessionSignature(
  signingSecret: string,
  payloadSegment: string,
): string {
  return createHmac('sha256', signingSecret)
    .update(`${STAFF_DOCUMENT_SHARE_SESSION_DOMAIN}:${payloadSegment}`)
    .digest('base64url');
}

function timingSafeEqualBase64Url(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function isShareSessionPayload(value: unknown): value is StaffDocumentShareSessionPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.v === STAFF_DOCUMENT_SHARE_SESSION_VERSION &&
    typeof record.staffId === 'string' &&
    record.staffId.length > 0 &&
    typeof record.tokenIssuedAt === 'number' &&
    Number.isFinite(record.tokenIssuedAt) &&
    typeof record.exp === 'number' &&
    Number.isFinite(record.exp)
  );
}
