import { describe, expect, it } from 'vitest';
import {
  assertShareSessionMatchesStaffShareState,
  buildShareTokenPersistValues,
  buildShareTokenRevokeValues,
  isStaffDocumentShareTokenActive,
  resolveStaffDocumentShareTokenState,
  type StaffDocumentShareFields,
} from './staff-document-share-state.util';

const CREATED_AT = new Date('2026-08-01T12:00:00.000Z');
const REVOKED_AT = new Date('2026-08-02T12:00:00.000Z');

function fields(overrides: Partial<StaffDocumentShareFields> = {}): StaffDocumentShareFields {
  return {
    documentShareTokenHash: 'abc123',
    documentShareTokenCreatedAt: CREATED_AT,
    documentShareTokenRevokedAt: null,
    ...overrides,
  };
}

describe('resolveStaffDocumentShareTokenState', () => {
  it('returns none when hash or createdAt is missing', () => {
    expect(resolveStaffDocumentShareTokenState(fields({ documentShareTokenHash: null }))).toBe('none');
    expect(resolveStaffDocumentShareTokenState(fields({ documentShareTokenCreatedAt: null }))).toBe(
      'none',
    );
  });

  it('returns active when hash and createdAt exist and not revoked', () => {
    expect(resolveStaffDocumentShareTokenState(fields())).toBe('active');
    expect(isStaffDocumentShareTokenActive(fields())).toBe(true);
  });

  it('returns revoked when revoked_at is set', () => {
    expect(
      resolveStaffDocumentShareTokenState(fields({ documentShareTokenRevokedAt: REVOKED_AT })),
    ).toBe('revoked');
    expect(isStaffDocumentShareTokenActive(fields({ documentShareTokenRevokedAt: REVOKED_AT }))).toBe(
      false,
    );
  });
});

describe('buildShareTokenPersistValues', () => {
  it('clears revoked_at on generation/rotation persist shape', () => {
    expect(
      buildShareTokenPersistValues({ createdAt: CREATED_AT, hash: 'deadbeef'.repeat(8) }),
    ).toEqual({
      documentShareTokenHash: 'deadbeef'.repeat(8),
      documentShareTokenCreatedAt: CREATED_AT,
      documentShareTokenRevokedAt: null,
    });
  });
});

describe('buildShareTokenRevokeValues', () => {
  it('sets revoked_at without clearing hash or created_at', () => {
    expect(buildShareTokenRevokeValues(REVOKED_AT)).toEqual({
      documentShareTokenRevokedAt: REVOKED_AT,
    });
  });
});

describe('assertShareSessionMatchesStaffShareState', () => {
  it('accepts matching active session epoch', () => {
    expect(
      assertShareSessionMatchesStaffShareState({
        sessionStaffId: 'staff-1',
        sessionTokenIssuedAt: CREATED_AT.getTime(),
        staffId: 'staff-1',
        shareFields: fields(),
      }),
    ).toBe(true);
  });

  it('rejects revoked share state even with matching epoch', () => {
    expect(
      assertShareSessionMatchesStaffShareState({
        sessionStaffId: 'staff-1',
        sessionTokenIssuedAt: CREATED_AT.getTime(),
        staffId: 'staff-1',
        shareFields: fields({ documentShareTokenRevokedAt: REVOKED_AT }),
      }),
    ).toBe(false);
  });

  it('rejects stale session epoch after rotation', () => {
    expect(
      assertShareSessionMatchesStaffShareState({
        sessionStaffId: 'staff-1',
        sessionTokenIssuedAt: CREATED_AT.getTime() - 1,
        staffId: 'staff-1',
        shareFields: fields(),
      }),
    ).toBe(false);
  });

  it('rejects mismatched staff id', () => {
    expect(
      assertShareSessionMatchesStaffShareState({
        sessionStaffId: 'staff-1',
        sessionTokenIssuedAt: CREATED_AT.getTime(),
        staffId: 'staff-2',
        shareFields: fields(),
      }),
    ).toBe(false);
  });
});
