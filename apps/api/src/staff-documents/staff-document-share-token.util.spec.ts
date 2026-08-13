import { describe, expect, it } from 'vitest';
import {
  deriveStaffDocumentShareToken,
  hashStaffDocumentShareToken,
  timingSafeEqualHex,
  verifyStaffDocumentShareToken,
  verifyStaffDocumentShareTokenHash,
} from './staff-document-share-token.util';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const OTHER_SIGNING_SECRET = 'other-document-share-signing-secret-32chars';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_STAFF_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = new Date('2026-08-01T12:00:00.000Z');
const OTHER_CREATED_AT = new Date('2026-08-02T12:00:00.000Z');

describe('deriveStaffDocumentShareToken', () => {
  it('is deterministic for same staff, createdAt, and secret', () => {
    const first = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const second = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    expect(first).toBe(second);
  });

  it('changes when staffId changes', () => {
    const a = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const b = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, OTHER_STAFF_ID, CREATED_AT);
    expect(a).not.toBe(b);
  });

  it('changes when createdAt changes', () => {
    const a = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const b = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, OTHER_CREATED_AT);
    expect(a).not.toBe(b);
  });

  it('changes when signing secret changes', () => {
    const a = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const b = deriveStaffDocumentShareToken(OTHER_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    expect(a).not.toBe(b);
  });

  it('returns base64url-safe output with 256-bit strength', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });
});

describe('hashStaffDocumentShareToken', () => {
  it('is deterministic', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    expect(hashStaffDocumentShareToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashStaffDocumentShareToken(token)).toBe(hashStaffDocumentShareToken(token));
  });
});

describe('verifyStaffDocumentShareTokenHash', () => {
  it('accepts matching token/hash pairs', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const hash = hashStaffDocumentShareToken(token);
    expect(verifyStaffDocumentShareTokenHash(token, hash)).toBe(true);
  });

  it('rejects modified tokens', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const hash = hashStaffDocumentShareToken(token);
    expect(verifyStaffDocumentShareTokenHash(`${token}x`, hash)).toBe(false);
  });

  it('rejects missing stored hash', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    expect(verifyStaffDocumentShareTokenHash(token, null)).toBe(false);
  });
});

describe('verifyStaffDocumentShareToken', () => {
  it('accepts valid derived tokens against stored hash', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const hash = hashStaffDocumentShareToken(token);
    expect(
      verifyStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT, token, hash),
    ).toBe(true);
  });

  it('rejects tokens that match hash but not derivation', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, OTHER_STAFF_ID, CREATED_AT);
    const hash = hashStaffDocumentShareToken(token);
    expect(
      verifyStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT, token, hash),
    ).toBe(false);
  });
});

describe('timingSafeEqualHex', () => {
  it('compares equal hex digests', () => {
    const digest = hashStaffDocumentShareToken('example');
    expect(timingSafeEqualHex(digest, digest)).toBe(true);
  });

  it('rejects unequal length or malformed values safely', () => {
    expect(timingSafeEqualHex('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualHex('g'.repeat(64), 'f'.repeat(64))).toBe(false);
  });
});

describe('persistence shape', () => {
  it('never includes raw token in hash helper output', () => {
    const token = deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, CREATED_AT);
    const hash = hashStaffDocumentShareToken(token);
    expect(hash).not.toContain(token);
    expect(hash).toHaveLength(64);
  });
});
