import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS,
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
  STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
  STAFF_DOCUMENT_SHARE_SESSION_TTL_MS,
  STAFF_DOCUMENT_SHARE_SESSION_TTL_SECONDS,
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

describe('share session TTL constants', () => {
  it('keeps signed-session and cookie maxAge aligned at 30 minutes', () => {
    expect(STAFF_DOCUMENT_SHARE_SESSION_TTL_SECONDS).toBe(30 * 60);
    expect(STAFF_DOCUMENT_SHARE_SESSION_TTL_MS).toBe(STAFF_DOCUMENT_SHARE_SESSION_TTL_SECONDS * 1000);
    expect(STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS).toBe(STAFF_DOCUMENT_SHARE_SESSION_TTL_MS);
  });
});

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

describe('share session lifetime beyond one second', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('remains valid several minutes after issuance and rejects after 30 minutes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);

    const session = signStaffDocumentShareSession(TEST_SIGNING_SECRET, {
      staffId: STAFF_ID,
      tokenIssuedAt: TOKEN_ISSUED_AT,
      nowMs: NOW_MS,
    });

    vi.setSystemTime(NOW_MS + 5_000);
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, session)).not.toBeNull();

    vi.setSystemTime(NOW_MS + 10 * 60 * 1000);
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, session)).not.toBeNull();

    vi.setSystemTime(NOW_MS + STAFF_DOCUMENT_SHARE_SESSION_TTL_MS);
    expect(verifyStaffDocumentShareSession(TEST_SIGNING_SECRET, session)).toBeNull();
  });
});

describe('staffDocumentShareSessionCookieOptions', () => {
  it('uses Express maxAge milliseconds matching the 30-minute signed session TTL', () => {
    expect(staffDocumentShareSessionCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH,
      maxAge: STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS,
    });
    expect(STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME).toBe('intra_staff_share');
  });

  it('omits Secure when SESSION_COOKIE_SECURE is false for local HTTP development', () => {
    expect(staffDocumentShareSessionCookieOptions({ secure: false }).secure).toBe(false);
  });
});

describe('serialized Set-Cookie header', () => {
  async function captureSetCookie(secure: boolean): Promise<string> {
    const app = express();
    app.get('/set', (_req, res) => {
      res.cookie(
        STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
        'session-token',
        staffDocumentShareSessionCookieOptions({ secure }),
      );
      res.sendStatus(204);
    });

    const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
      const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/set`);
      expect(response.status).toBe(204);
      return response.headers.get('set-cookie') ?? '';
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  it('serializes Max-Age=1800 with HttpOnly, Path, and SameSite=Lax', async () => {
    const setCookie = await captureSetCookie(false);
    expect(setCookie).toContain(`${STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME}=session-token`);
    expect(setCookie).toMatch(/Max-Age=1800(?:;|$)/);
    expect(setCookie).toContain('Path=/api/v1/public/staff-documents/share');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).not.toMatch(/Secure/i);
  });

  it('includes Secure when enabled for HTTPS deployments', async () => {
    const setCookie = await captureSetCookie(true);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/Max-Age=1800(?:;|$)/);
  });

  it('sets Expires header consistent with the 30-minute Max-Age', async () => {
    vi.useFakeTimers();
    const issuedAt = new Date('2026-08-13T18:00:00.000Z');
    vi.setSystemTime(issuedAt);

    try {
      const setCookie = await captureSetCookie(false);
      expect(setCookie).toMatch(/Max-Age=1800(?:;|$)/);
      expect(setCookie).toMatch(/Expires=/);
      const expiresMatch = setCookie.match(/Expires=([^;]+)/);
      expect(expiresMatch).toBeTruthy();
      const expiresAt = new Date(expiresMatch![1]!);
      expect(expiresAt.getTime() - issuedAt.getTime()).toBe(STAFF_DOCUMENT_SHARE_SESSION_COOKIE_MAX_AGE_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});
