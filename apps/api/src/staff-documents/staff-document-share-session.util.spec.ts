import { describe, expect, it } from 'vitest';
import {
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
  STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
} from './staff-document-share.constants';
import {
  signStaffDocumentShareSession,
  staffDocumentShareSessionCookieOptions,
  verifyStaffDocumentShareSession,
} from './staff-document-share-session.util';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const OTHER_SIGNING_SECRET = 'other-document-share-signing-secret-32chars';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const TOKEN_ISSUED_AT = 1_754_054_400_000;
const NOW_MS = TOKEN_ISSUED_AT + 1_000;

describe('signStaffDocumentShareSession', () => {
  it('produces a verifiable session without raw share token', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    expect(session).not.toContain('staff-document-share-token');
    expect(session.split('.')).toHaveLength(2);

    const payload = verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, session, NOW_MS + 1);
    expect(payload).toEqual({
      v: 1,
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      exp: NOW_MS + STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
    });
  });

  it('preserves tokenIssuedAt exactly through serialization', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    const payload = verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, session, NOW_MS + 1);
    expect(payload?.tokenIssuedAt).toBe(TOKEN_ISSUED_AT);
  });
});

describe('verifyStaffDocumentShareSession', () => {
  it('rejects tampered payload segment', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    const [payloadSegment, signature] = session.split('.');
    const tamperedPayload = `${payloadSegment}x.${signature}`;
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, tamperedPayload, NOW_MS)).toBeNull();
  });

  it('rejects tampered signature', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    const [payloadSegment] = session.split('.');
    expect(
      verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, `${payloadSegment}.bad-signature`, NOW_MS),
    ).toBeNull();
  });

  it('rejects expired sessions', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    expect(
      verifyStaffDocumentShareSession(
        TEST_SIGNING_SECRET,
        session,
        NOW_MS + STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
      ),
    ).toBeNull();
  });

  it('rejects wrong signing secret', () => {
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    expect(verifyStaffDocumentShareSession(OTHER_SIGNING_SECRET, session, NOW_MS)).toBeNull();
  });

  it('rejects unsupported version', () => {
    const payloadSegment = Buffer.from(
      JSON.stringify({
        v: 99,
        staffId: STAFF_ID,
        tokenIssuedAt: TOKEN_ISSUED_AT,
        exp: NOW_MS + STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
      }),
      'utf8',
    ).toString('base64url');
    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });
    const signature = session.split('.')[1];
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, `${payloadSegment}.${signature}`, NOW_MS)).toBeNull();
  });

  it('rejects malformed values safely', () => {
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, '', NOW_MS)).toBeNull();
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, 'not-a-session', NOW_MS)).toBeNull();
  });
});

describe('staffDocumentShareSessionCookieOptions', () => {
  it('prepares HttpOnly secure cookie settings for future controller use', () => {
    expect(staffDocumentShareSessionCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
      maxAge: STAFF_DOCUMENT_SHARE_SESSION_TTL_MS / 1000,
    });
    expect(STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME).toBe('intra_staff_share');
  });
});
