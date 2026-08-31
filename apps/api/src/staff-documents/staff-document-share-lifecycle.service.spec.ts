import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STAFF_PORTAL_AUDIT_EVENTS, StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { StaffDocumentShareLifecycleService } from './staff-document-share-lifecycle.service';
import { StaffDocumentShareService } from './staff-document-share.service';
import { nextShareTokenRotationCreatedAt } from './staff-document-share-epoch.util';
import { normalizeStaffDocumentSlug } from './staff-document-slug.util';
import { staffDocumentSlugCandidates } from './staff-document-share-slug.util';
import { hashStaffDocumentShareToken } from './staff-document-share-token.util';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_USER_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_AT = new Date('2026-08-01T12:00:00.000Z');

function createShareService() {
  return new StaffDocumentShareService({
    getOrThrow: (key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return TEST_SIGNING_SECRET;
      throw new Error(`Unexpected config key: ${key}`);
    },
  } as unknown as ConfigService);
}

function baseStaffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAFF_ID,
    legalName: 'Jane Doe',
    displayName: 'Jane Doe',
    useDisplayName: true,
    documentSlug: null,
    documentShareTokenHash: null,
    documentShareTokenCreatedAt: null,
    documentShareTokenRevokedAt: null,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

type StaffRow = ReturnType<typeof baseStaffRow>;

function createHarness(
  initialRow: StaffRow = baseStaffRow(),
  options?: { slugCollisions?: Set<string>; useRealAudit?: boolean; allowShareGeneration?: boolean },
) {
  let row: StaffRow = { ...initialRow };
  const audit = vi.fn();
  const slugCollisions = options?.slugCollisions ?? new Set<string>();
  const useRealAudit = options?.useRealAudit ?? false;
  const allowShareGeneration = options?.allowShareGeneration ?? true;

  const shareService = createShareService();
  const config = {
    get: (key: string) => {
      if (key === 'APP_PUBLIC_URL') return 'https://platform.intra.ca';
      if (key === 'APP_HOST') return 'platform.intra.ca';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    },
  } as unknown as ConfigService;

  const applyUpdate = async (values: Record<string, unknown>) => {
    if (
      typeof values.documentSlug === 'string' &&
      values.documentShareTokenHash === undefined &&
      !row.documentSlug &&
      slugCollisions.has(values.documentSlug)
    ) {
      throw { code: '23505', constraint: 'staff_document_slug_unique' };
    }
    row = { ...row, ...values, updatedAt: new Date() } as StaffRow;
    return [row];
  };

  const createUpdateChain = () => ({
    set: (values: Record<string, unknown>) => ({
      where: () => {
        const promise = applyUpdate(values);
        return {
          returning: () => promise,
          then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
            promise.then(resolve, reject),
        };
      },
    }),
  });

  const tx = {
    select: vi.fn().mockImplementation(() => ({
      from: () => ({
        where: () => ({
          for: vi.fn().mockImplementation(async () => [row]),
          then: (resolve: (value: StaffRow[]) => void) => resolve([row]),
        }),
      }),
    })),
    transaction: vi.fn().mockImplementation(async (fn: (inner: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
    update: vi.fn().mockImplementation(() => createUpdateChain()),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  };

  const db = {
    select: vi.fn().mockImplementation(() => ({
      from: () => ({
        where: () => Promise.resolve([row]),
      }),
    })),
    transaction: vi.fn().mockImplementation(async (fn: (inner: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(row);
      try {
        return await fn(tx);
      } catch (err) {
        row = snapshot;
        throw err;
      }
    }),
    update: vi.fn().mockImplementation(() => createUpdateChain()),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  } as never;

  const auditService = useRealAudit
    ? new StaffPortalAuditService(db)
    : ({ record: audit } as never);

  const service = new StaffDocumentShareLifecycleService(db, shareService, auditService, config);

  if (allowShareGeneration) {
    vi.spyOn(service, 'assessDocumentShareReadiness').mockResolvedValue({
      ready: true,
      mode: 'generatable',
    });
  }

  return {
    service,
    shareService,
    audit,
    auditService,
    tx,
    db,
    get row() {
      return row;
    },
  };
}

describe('StaffDocumentShareLifecycleService status', () => {
  it('returns none without leaking secrets', async () => {
    const { service } = createHarness();
    const status = await service.getShareStatus(STAFF_ID);
    expect(status).toEqual({
      state: 'none',
      slug: null,
      createdAt: null,
      revokedAt: null,
      canCopy: false,
    });
    expect(JSON.stringify(status)).not.toMatch(/token|hash|secret/i);
  });

  it('returns active with canCopy true', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const { service } = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: null,
      }),
    );

    const status = await service.getShareStatus(STAFF_ID);
    expect(status.state).toBe('active');
    expect(status.canCopy).toBe(true);
    expect(JSON.stringify(status)).not.toContain(generated.hash);
  });
});

describe('StaffDocumentShareLifecycleService generate', () => {
  it('creates first link, assigns slug, stores hash only, and audits', async () => {
    const harness = createHarness(
      baseStaffRow(),
      { slugCollisions: new Set(['jane-doe']) },
    );
    const result = await harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID);

    expect(result.shareUrl.startsWith('https://platform.intra.ca/documents/jane-doe-2#')).toBe(true);
    expect(harness.row.documentShareTokenHash).toBeTruthy();
    expect(harness.row.documentShareTokenRevokedAt).toBeNull();
    expect(harness.row.documentSlug).toBe('jane-doe-2');
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkGenerated }),
      harness.tx,
    );
    expect(JSON.stringify(harness.audit.mock.calls[0]?.[0]?.detail ?? {})).not.toMatch(/shareUrl|token|hash/i);
  });

  it('conflicts when already active', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const { service } = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
    );

    await expect(service.generateShareLink(STAFF_ID, ACTOR_USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates a new token after revocation and keeps old token invalid', async () => {
    const oldGenerated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const harness = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: oldGenerated.hash,
        documentShareTokenCreatedAt: oldGenerated.createdAt,
        documentShareTokenRevokedAt: new Date('2026-08-02T12:00:00.000Z'),
      }),
    );

    const result = await harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(harness.row.documentShareTokenRevokedAt).toBeNull();
    expect(harness.row.documentShareTokenHash).not.toBe(oldGenerated.hash);
    expect(oldGenerated.token).not.toBe(result.shareUrl.split('#')[1]);
  });
});

describe('StaffDocumentShareLifecycleService copy', () => {
  it('reconstructs the same URL without mutating state', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const harness = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
    );
    const beforeHash = harness.row.documentShareTokenHash;

    const first = await harness.service.copyShareLink(STAFF_ID);
    const second = await harness.service.copyShareLink(STAFF_ID);
    expect(first.shareUrl).toBe(second.shareUrl);
    expect(harness.row.documentShareTokenHash).toBe(beforeHash);
  });

  it('works from a fresh service instance without persisted raw token', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const persisted = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
    );
    const fresh = createHarness(persisted.row);
    const copied = await fresh.service.copyShareLink(STAFF_ID);
    expect(copied.shareUrl).toBe(`https://platform.intra.ca/documents/jane-doe#${generated.token}`);
  });

  it('rejects copy for none or revoked states', async () => {
    const none = createHarness();
    await expect(none.service.copyShareLink(STAFF_ID)).rejects.toBeInstanceOf(ConflictException);

    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const revoked = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: new Date('2026-08-02T12:00:00.000Z'),
      }),
    );
    await expect(revoked.service.copyShareLink(STAFF_ID)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('StaffDocumentShareLifecycleService rotate', () => {
  it('creates a new URL, keeps slug stable, and invalidates old token', async () => {
    const initial = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const harness = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: initial.hash,
        documentShareTokenCreatedAt: initial.createdAt,
      }),
    );

    const rotated = await harness.service.rotateShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(harness.row.documentSlug).toBe('jane-doe');
    expect(harness.row.documentShareTokenHash).not.toBe(initial.hash);
    expect(rotated.shareUrl).not.toContain(`#${initial.token}`);
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkRotated }),
      harness.tx,
    );
  });

  it('uses a strictly greater epoch when clock equals previous epoch', () => {
    const next = nextShareTokenRotationCreatedAt(CREATED_AT, CREATED_AT.getTime());
    expect(next.getTime()).toBe(CREATED_AT.getTime() + 1);
  });
});

describe('StaffDocumentShareLifecycleService revoke', () => {
  it('revokes active link while preserving slug/hash/createdAt', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const harness = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
    );

    const status = await harness.service.revokeShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(status.state).toBe('revoked');
    expect(status.canCopy).toBe(false);
    expect(harness.row.documentShareTokenHash).toBe(generated.hash);
    expect(harness.row.documentSlug).toBe('jane-doe');
    await expect(harness.service.copyShareLink(STAFF_ID)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.shareLinkRevoked }),
      harness.tx,
    );
  });

  it('is idempotent when already revoked', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const { service, audit } = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: new Date('2026-08-02T12:00:00.000Z'),
      }),
    );

    const status = await service.revokeShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(status.state).toBe('revoked');
    expect(audit).not.toHaveBeenCalled();
  });

  it('rejects revoke when no link exists', async () => {
    const { service } = createHarness();
    await expect(service.revokeShareLink(STAFF_ID, ACTOR_USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('StaffDocumentShareLifecycleService email contract', () => {
  it('buildActiveStaffDocumentShareUrl returns null unless active', async () => {
    const none = createHarness();
    expect(await none.service.buildActiveStaffDocumentShareUrl(STAFF_ID)).toBeNull();

    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const active = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
    );
    expect(await active.service.buildActiveStaffDocumentShareUrl(STAFF_ID)).toBe(
      `https://platform.intra.ca/documents/jane-doe#${generated.token}`,
    );
  });
});

describe('StaffDocumentShareLifecycleService staff existence', () => {
  it('returns not found for missing staff', async () => {
    const db = {
      select: vi.fn().mockImplementation(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })),
      transaction: vi.fn(),
      update: vi.fn(),
    } as never;
    const missing = new StaffDocumentShareLifecycleService(
      db,
      createShareService(),
      { record: vi.fn() } as never,
      { get: () => 'https://platform.intra.ca' } as never,
    );
    await expect(missing.getShareStatus(STAFF_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffDocumentShareLifecycleService slug collisions', () => {
  it('fails cleanly when slug retries are exhausted', async () => {
    const baseSlug = normalizeStaffDocumentSlug('Jane Doe');
    const { service } = createHarness(baseStaffRow(), {
      slugCollisions: new Set(staffDocumentSlugCandidates(baseSlug)),
    });

    await expect(service.generateShareLink(STAFF_ID, ACTOR_USER_ID)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('StaffDocumentShareLifecycleService hash persistence', () => {
  it('stores only hash values in the database row', async () => {
    const harness = createHarness();
    const result = await harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID);
    const token = result.shareUrl.split('#')[1]!;
    expect(harness.row.documentShareTokenHash).toBe(hashStaffDocumentShareToken(token));
  });
});

describe('nextShareTokenRotationCreatedAt edge cases', () => {
  it('advances when clock is behind previous epoch', () => {
    const previous = new Date('2026-08-01T12:00:00.001Z');
    const next = nextShareTokenRotationCreatedAt(previous, previous.getTime() - 1);
    expect(next.getTime()).toBe(previous.getTime() + 1);
  });
});

describe('StaffDocumentShareLifecycleService transaction safety', () => {
  it('writes audit through the active transaction executor, not the global pool', async () => {
    const harness = createHarness(baseStaffRow(), { useRealAudit: true });
    await harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID);

    expect(harness.tx.insert).toHaveBeenCalled();
    expect(harness.db.insert).not.toHaveBeenCalled();
  });

  it('rolls back lifecycle mutation when audit insert fails', async () => {
    const harness = createHarness(baseStaffRow(), { useRealAudit: true });
    harness.tx.insert.mockImplementationOnce(() => ({
      values: vi.fn().mockRejectedValue(new Error('audit insert failed')),
    }));

    await expect(harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID)).rejects.toThrow(
      'audit insert failed',
    );
    expect(harness.row.documentShareTokenHash).toBeNull();
    expect(harness.row.documentSlug).toBeNull();
  });

  it('uses nested savepoints for slug collision retries inside the open transaction', async () => {
    const harness = createHarness(baseStaffRow(), {
      slugCollisions: new Set(['jane-doe']),
    });

    await harness.service.generateShareLink(STAFF_ID, ACTOR_USER_ID);

    expect(harness.tx.transaction).toHaveBeenCalled();
    expect(harness.row.documentSlug).toBe('jane-doe-2');
  });

  it('completes rotate and revoke using the transaction executor for audit', async () => {
    const generated = createShareService().generateShareTokenState(STAFF_ID, CREATED_AT);
    const harness = createHarness(
      baseStaffRow({
        documentSlug: 'jane-doe',
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
      }),
      { useRealAudit: true },
    );

    await harness.service.rotateShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(harness.tx.insert).toHaveBeenCalled();
    expect(harness.db.insert).not.toHaveBeenCalled();

    harness.tx.insert.mockClear();
    harness.db.insert.mockClear();

    await harness.service.revokeShareLink(STAFF_ID, ACTOR_USER_ID);
    expect(harness.tx.insert).toHaveBeenCalled();
    expect(harness.db.insert).not.toHaveBeenCalled();
  });
});
