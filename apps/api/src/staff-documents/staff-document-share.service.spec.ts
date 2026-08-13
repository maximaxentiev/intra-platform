import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { StaffDocumentShareService } from './staff-document-share.service';
import {
  deriveStaffDocumentShareToken,
  hashStaffDocumentShareToken,
} from './staff-document-share-token.util';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';

function createService(): StaffDocumentShareService {
  const config = {
    getOrThrow: (key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') {
        return TEST_SIGNING_SECRET;
      }
      throw new Error(`Unexpected config key: ${key}`);
    },
  } as unknown as ConfigService;
  return new StaffDocumentShareService(config);
}

describe('StaffDocumentShareService generation', () => {
  it('returns token, hash, and the same createdAt used for derivation', () => {
    const service = createService();
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const generated = service.generateShareTokenState(STAFF_ID, createdAt);

    expect(generated.createdAt).toBe(createdAt);
    expect(generated.token).toBe(
      deriveStaffDocumentShareToken(TEST_SIGNING_SECRET, STAFF_ID, createdAt),
    );
    expect(generated.hash).toBe(hashStaffDocumentShareToken(generated.token));
  });

  it('builds persist values with revoked_at cleared', () => {
    const service = createService();
    const result = service.buildPersistValuesForGeneration(STAFF_ID, new Date('2026-08-01T12:00:00.000Z'));
    expect(result.persist.documentShareTokenRevokedAt).toBeNull();
    expect(result.persist.documentShareTokenHash).toBe(result.hash);
    expect(result.persist.documentShareTokenCreatedAt).toBe(result.createdAt);
  });
});

describe('StaffDocumentShareService reconstruction', () => {
  it('reconstructs the same active token from persisted created_at', () => {
    const service = createService();
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const generated = service.generateShareTokenState(STAFF_ID, createdAt);

    expect(
      service.reconstructActiveShareToken(STAFF_ID, {
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: null,
      }),
    ).toBe(generated.token);
  });

  it('returns null for revoked or incomplete state', () => {
    const service = createService();
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const generated = service.generateShareTokenState(STAFF_ID, createdAt);

    expect(
      service.reconstructActiveShareToken(STAFF_ID, {
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: new Date(),
      }),
    ).toBeNull();

    expect(
      service.reconstructActiveShareToken(STAFF_ID, {
        documentShareTokenHash: null,
        documentShareTokenCreatedAt: null,
        documentShareTokenRevokedAt: null,
      }),
    ).toBeNull();
  });
});

describe('StaffDocumentShareService rotation and revocation', () => {
  it('rotation produces a different token and old token fails verification', () => {
    const service = createService();
    const initial = service.buildPersistValuesForGeneration(
      STAFF_ID,
      new Date('2026-08-01T12:00:00.000Z'),
    );
    const rotated = service.buildPersistValuesForRotation(STAFF_ID);

    expect(rotated.token).not.toBe(initial.token);
    expect(
      service.verifyShareToken(STAFF_ID, rotated.persist, initial.token),
    ).toBe(false);
    expect(service.verifyShareToken(STAFF_ID, rotated.persist, rotated.token)).toBe(true);
  });

  it('revoked state fails verification even when token is reconstructable', () => {
    const service = createService();
    const generated = service.generateShareTokenState(STAFF_ID, new Date('2026-08-01T12:00:00.000Z'));
    const revokedFields = {
      documentShareTokenHash: generated.hash,
      documentShareTokenCreatedAt: generated.createdAt,
      documentShareTokenRevokedAt: new Date('2026-08-02T12:00:00.000Z'),
    };

    expect(service.verifyShareToken(STAFF_ID, revokedFields, generated.token)).toBe(false);
    expect(service.reconstructActiveShareToken(STAFF_ID, revokedFields)).toBeNull();
  });

  it('re-enable requires new generation rather than clearing revoked_at alone', () => {
    const service = createService();
    const revoked = service.buildRevokeValues(new Date('2026-08-02T12:00:00.000Z'));
    expect(revoked.documentShareTokenRevokedAt).toBeInstanceOf(Date);

    const reenabled = service.buildPersistValuesForGeneration(STAFF_ID, new Date('2026-08-03T12:00:00.000Z'));
    expect(reenabled.persist.documentShareTokenRevokedAt).toBeNull();
    expect(reenabled.hash).not.toBeUndefined();
  });
});

describe('StaffDocumentShareService share session binding', () => {
  it('binds signed session to active staff share epoch', () => {
    const service = createService();
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const generated = service.generateShareTokenState(STAFF_ID, createdAt);
    const session = service.verifyShareSession(
      service.signShareSession(STAFF_ID, createdAt.getTime(), createdAt.getTime()),
      createdAt.getTime(),
    );

    expect(session).not.toBeNull();
    expect(
      service.assertShareSessionValidForStaff(session!, STAFF_ID, {
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: null,
      }),
    ).toBe(true);
  });

  it('invalidates session after rotation or revocation', () => {
    const service = createService();
    const createdAt = new Date('2026-08-01T12:00:00.000Z');
    const generated = service.generateShareTokenState(STAFF_ID, createdAt);
    const session = service.verifyShareSession(
      service.signShareSession(STAFF_ID, createdAt.getTime(), createdAt.getTime()),
      createdAt.getTime(),
    );

    const rotatedCreatedAt = new Date('2026-08-02T12:00:00.000Z');
    const rotated = service.generateShareTokenState(STAFF_ID, rotatedCreatedAt);
    expect(
      service.assertShareSessionValidForStaff(session!, STAFF_ID, {
        documentShareTokenHash: rotated.hash,
        documentShareTokenCreatedAt: rotated.createdAt,
        documentShareTokenRevokedAt: null,
      }),
    ).toBe(false);

    expect(
      service.assertShareSessionValidForStaff(session!, STAFF_ID, {
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: new Date('2026-08-03T12:00:00.000Z'),
      }),
    ).toBe(false);
  });
});
