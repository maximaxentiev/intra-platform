import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import {
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { STAFF_PORTAL_AUDIT_EVENTS } from '../staff-portal/staff-portal-audit.service';
import { STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME } from './staff-document-share.constants';
import { PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE } from './staff-document-share-public.constants';
import { StaffDocumentSharePublicAuthService } from './staff-document-share-public-auth.service';
import { StaffDocumentSharePublicService } from './staff-document-share-public.service';
import { StaffDocumentShareService } from './staff-document-share.service';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const STAFF_A_ID = '11111111-1111-4111-8111-111111111111';
const STAFF_B_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = new Date('2026-08-01T12:00:00.000Z');
const FILE_VSC = '33333333-3333-4333-8333-333333333333';
const FILE_FA = '44444444-4444-4444-8444-444444444444';

function createShareService() {
  return new StaffDocumentShareService({
    getOrThrow: (key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return TEST_SIGNING_SECRET;
      throw new Error(key);
    },
  } as unknown as ConfigService);
}

function staffRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STAFF_A_ID,
    legalName: 'Jane Doe',
    displayName: 'Jane Doe',
    useDisplayName: true,
    role: 'ECE',
    documentSlug: 'jane-doe',
    documentShareTokenHash: null,
    documentShareTokenCreatedAt: null,
    documentShareTokenRevokedAt: null,
    ...overrides,
  };
}

type HarnessState = {
  staffRows: ReturnType<typeof staffRow>[];
  sets: Array<Record<string, unknown>>;
  submissions: Array<Record<string, unknown>>;
  files: Array<Record<string, unknown>>;
};

type DrizzleEqConstraint = { column: string; value: unknown };
type DrizzleInConstraint = { column: string; values: unknown[] };

function extractDrizzleConstraints(
  condition: unknown,
): Array<DrizzleEqConstraint | DrizzleInConstraint> {
  const constraints: Array<DrizzleEqConstraint | DrizzleInConstraint> = [];

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') {
      return;
    }

    const sql = node as { queryChunks?: unknown[] };
    if (!Array.isArray(sql.queryChunks)) {
      return;
    }

    let columnName: string | null = null;
    let eqValue: unknown;
    let inValues: unknown[] | null = null;

    for (const chunk of sql.queryChunks) {
      if (Array.isArray(chunk)) {
        inValues = chunk.map((param) => (param as { value: unknown }).value);
        continue;
      }

      if (!chunk || typeof chunk !== 'object') {
        continue;
      }

      if ('name' in chunk && typeof (chunk as { name: string }).name === 'string') {
        columnName = (chunk as { name: string }).name;
      }

      if ('value' in chunk && 'encoder' in chunk) {
        eqValue = (chunk as { value: unknown }).value;
      }

      if ('queryChunks' in chunk) {
        walk(chunk);
      }
    }

    if (columnName && inValues) {
      constraints.push({ column: columnName, values: inValues });
    } else if (columnName && eqValue !== undefined) {
      constraints.push({ column: columnName, value: eqValue });
    }

    for (const chunk of sql.queryChunks) {
      if (chunk && typeof chunk === 'object' && 'queryChunks' in chunk && !('name' in chunk)) {
        walk(chunk);
      }
    }
  };

  walk(condition);
  return constraints;
}

const DRIZZLE_COLUMN_TO_ROW_KEY: Record<string, string> = {
  document_slug: 'documentSlug',
  staff_id: 'staffId',
  submission_id: 'submissionId',
  document_type: 'documentType',
};

function rowValue(row: Record<string, unknown>, column: string): unknown {
  const key = DRIZZLE_COLUMN_TO_ROW_KEY[column] ?? column;
  return row[key];
}

function filterRowsByCondition(
  rows: Array<Record<string, unknown>>,
  condition: unknown,
): Array<Record<string, unknown>> {
  const constraints = extractDrizzleConstraints(condition);
  if (constraints.length === 0) {
    return rows;
  }

  return rows.filter((row) =>
    constraints.every((constraint) =>
      'values' in constraint
        ? constraint.values.includes(rowValue(row, constraint.column))
        : rowValue(row, constraint.column) === constraint.value,
    ),
  );
}

function createDbMock(state: HarnessState) {
  function rowsForTable(table: unknown): Array<Record<string, unknown>> {
    if (table === staff) return state.staffRows;
    if (table === staffDocumentSets) return state.sets;
    if (table === staffDocumentSubmissions) return state.submissions;
    if (table === staffDocumentFiles) return state.files;
    return [];
  }

  return {
    select: vi.fn().mockImplementation(() => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          const promise = Promise.resolve(filterRowsByCondition(rowsForTable(table), condition));
          return {
            limit: () => promise,
            then: (resolve: (value: unknown) => void, reject?: (reason: unknown) => void) =>
              promise.then(resolve, reject),
          };
        },
      }),
    })),
  } as never;
}

function createHarness(activeStaff = staffRow()) {
  const shareService = createShareService();
  const generated = shareService.generateShareTokenState(STAFF_A_ID, CREATED_AT);

  const state: HarnessState = {
    staffRows: [
      {
        ...activeStaff,
        documentShareTokenHash: generated.hash,
        documentShareTokenCreatedAt: generated.createdAt,
        documentShareTokenRevokedAt: null,
      },
    ],
    sets: [
      {
        staffId: STAFF_A_ID,
        documentType: 'vulnerable_sector_check',
        currentSubmissionId: 'sub-vsc',
        remindersEnabled: true,
      },
      {
        staffId: STAFF_A_ID,
        documentType: 'first_aid_cpr',
        currentSubmissionId: 'sub-fa',
        remindersEnabled: true,
      },
      {
        staffId: STAFF_A_ID,
        documentType: 'immunizations',
        currentSubmissionId: 'sub-imm',
        remindersEnabled: true,
      },
    ],
    submissions: [
      {
        id: 'sub-vsc',
        reviewStatus: 'approved',
        expiryDate: '2029-08-01',
        processedDate: '2026-08-01',
        submittedAt: CREATED_AT,
        reviewedAt: CREATED_AT,
        supersededAt: null,
      },
      {
        id: 'sub-fa',
        reviewStatus: 'approved',
        expiryDate: '2029-08-01',
        processedDate: null,
        submittedAt: CREATED_AT,
        reviewedAt: CREATED_AT,
        supersededAt: null,
      },
      {
        id: 'sub-imm',
        reviewStatus: 'approved',
        expiryDate: null,
        processedDate: null,
        submittedAt: CREATED_AT,
        reviewedAt: CREATED_AT,
        supersededAt: null,
      },
    ],
    files: [
      {
        id: FILE_VSC,
        submissionId: 'sub-vsc',
        originalFilename: 'vsc.pdf',
        contentType: 'application/pdf',
        byteSize: 100,
        storageKey: `staff/${STAFF_A_ID}/sub-vsc/${FILE_VSC}/vsc.pdf`,
      },
      {
        id: FILE_FA,
        submissionId: 'sub-fa',
        originalFilename: 'fa.pdf',
        contentType: 'application/pdf',
        byteSize: 100,
        storageKey: `staff/${STAFF_A_ID}/sub-fa/${FILE_FA}/fa.pdf`,
      },
      {
        id: 'file-imm',
        submissionId: 'sub-imm',
        originalFilename: 'imm.pdf',
        contentType: 'application/pdf',
        byteSize: 100,
        storageKey: `staff/${STAFF_A_ID}/sub-imm/file-imm/imm.pdf`,
      },
    ],
  };

  const audit = vi.fn();
  const storage = {
    getObjectStream: vi.fn().mockResolvedValue({
      body: Readable.from([Buffer.from('%PDF-1.4')]),
      contentType: 'application/pdf',
    }),
  };

  const db = createDbMock(state);

  const config = {
    get: (key: string) => (key === 'SESSION_COOKIE_SECURE' ? 'false' : undefined),
  } as unknown as ConfigService;

  const auth = new StaffDocumentSharePublicAuthService(db, shareService, config);
  const service = new StaffDocumentSharePublicService(db, shareService, auth, storage as never, {
    record: audit,
  } as never);

  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };

  return {
    service,
    auth,
    shareService,
    generated,
    audit,
    storage,
    res,
    state,
  };
}

describe('StaffDocumentSharePublicService exchangeSession', () => {
  it('sets cookie and audits on valid slug/token exchange', async () => {
    const harness = createHarness();
    const req = { cookies: {} } as never;
    const result = await harness.service.exchangeSession(
      'jane-doe',
      harness.generated.token,
      req,
      harness.res as never,
    );

    expect(result).toEqual({ ok: true });
    expect(harness.res.cookie).toHaveBeenCalledWith(
      STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true, path: '/api/v1/public/staff-documents/share' }),
    );
    expect(harness.res.clearCookie).not.toHaveBeenCalled();
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: STAFF_PORTAL_AUDIT_EVENTS.sharePageViewed }),
    );
  });

  it('clears existing cookie and returns unavailable on failed exchange', async () => {
    const harness = createHarness();
    const existing = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: existing } } as never;

    await expect(
      harness.service.exchangeSession('jane-doe', 'bad-token', req, harness.res as never),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);

    expect(harness.res.clearCookie).toHaveBeenCalledWith(
      STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME,
      expect.objectContaining({ path: '/api/v1/public/staff-documents/share', maxAge: 0 }),
    );
  });

  it('clears Staff A cookie when exchanging invalid Staff B link', async () => {
    const harness = createHarness();
    const staffBGenerated = harness.shareService.generateShareTokenState(STAFF_B_ID, CREATED_AT);
    harness.state.staffRows.push({
      ...staffRow({
        id: STAFF_B_ID,
        documentSlug: 'bob-smith',
        legalName: 'Bob Smith',
        displayName: 'Bob Smith',
      }),
      documentShareTokenHash: staffBGenerated.hash,
      documentShareTokenCreatedAt: staffBGenerated.createdAt,
      documentShareTokenRevokedAt: null,
    });

    const staffASession = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: staffASession } } as never;

    await expect(
      harness.service.exchangeSession('bob-smith', 'wrong-token', req, harness.res as never),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);

    expect(harness.res.clearCookie).toHaveBeenCalled();

    await expect(
      harness.service.getMetadata({ cookies: {} } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clears cookie on revoked and rotated token exchange attempts', async () => {
    const harness = createHarness();
    const req = { cookies: {} } as never;

    harness.state.staffRows[0] = {
      ...harness.state.staffRows[0],
      documentShareTokenRevokedAt: new Date(),
    };
    await expect(
      harness.service.exchangeSession('jane-doe', harness.generated.token, req, harness.res as never),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
    expect(harness.res.clearCookie).toHaveBeenCalled();

    harness.res.clearCookie.mockClear();
    const rotated = harness.shareService.buildPersistValuesForRotation(STAFF_A_ID, CREATED_AT);
    harness.state.staffRows[0] = {
      ...harness.state.staffRows[0],
      documentShareTokenRevokedAt: null,
      documentShareTokenHash: rotated.hash,
      documentShareTokenCreatedAt: rotated.createdAt,
    };

    await expect(
      harness.service.exchangeSession('jane-doe', harness.generated.token, req, harness.res as never),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
    expect(harness.res.clearCookie).toHaveBeenCalled();
  });
});

describe('StaffDocumentSharePublicService metadata', () => {
  it('returns only VSC and First Aid without internal fields', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    const metadata = await harness.service.getMetadata(req);
    expect(metadata.staff.displayName).toBe('Jane Doe');
    expect(metadata.staff.role).toBe('ECE');
    expect(metadata.documents.map((doc) => doc.documentType)).toEqual([
      'vulnerable_sector_check',
      'first_aid_cpr',
    ]);
    expect(JSON.stringify(metadata)).not.toMatch(
      /staffId|storageKey|reviewStatus|issueNote|submissionId|setId|checksum|documentSlug|documentShareTokenHash/i,
    );
  });

  it('returns empty documents when no shareable categories exist', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    harness.state.submissions = harness.state.submissions.map((submission) => ({
      ...submission,
      reviewStatus: 'pending_review',
    }));

    const metadata = await harness.service.getMetadata({
      cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session },
    } as never);

    expect(metadata.documents).toEqual([]);
  });

  it('rejects metadata when share state is revoked', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    harness.state.staffRows[0] = {
      ...harness.state.staffRows[0],
      documentShareTokenRevokedAt: new Date(),
    };

    await expect(
      harness.service.getMetadata({
        cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session },
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects metadata immediately after token rotation epoch changes', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const rotated = harness.shareService.buildPersistValuesForRotation(STAFF_A_ID, CREATED_AT);
    harness.state.staffRows[0] = {
      ...harness.state.staffRows[0],
      documentShareTokenHash: rotated.hash,
      documentShareTokenCreatedAt: rotated.createdAt,
    };

    await expect(
      harness.service.getMetadata({
        cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session },
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects metadata when staff row is deleted', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    harness.state.staffRows = [];

    await expect(
      harness.service.getMetadata({
        cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session },
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffDocumentSharePublicService streamFile', () => {
  it('streams an authorized public file and audits view', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    const result = await harness.service.streamFile(req, 'vulnerable_sector_check', FILE_VSC);
    expect(result.contentType).toBe('application/pdf');
    expect(harness.storage.getObjectStream).toHaveBeenCalled();
    expect(harness.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: STAFF_PORTAL_AUDIT_EVENTS.sharedDocumentViewed,
        detail: expect.objectContaining({ documentType: 'vulnerable_sector_check', fileId: FILE_VSC }),
      }),
    );
  });

  it('blocks health document types with generic unavailable', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    await expect(
      harness.service.streamFile(req, 'immunizations', 'file-imm'),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);

    await expect(
      harness.service.streamFile(req, 'covid19_vaccination', 'file-imm'),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
  });

  it('blocks wrong file id and wrong document type pairings', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    await expect(
      harness.service.streamFile(req, 'vulnerable_sector_check', FILE_FA),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
  });
});

describe('StaffDocumentSharePublicService live state', () => {
  it('hides a category when current submission becomes pending review', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    harness.state.submissions = [
      {
        id: 'sub-vsc',
        reviewStatus: 'pending_review',
        expiryDate: '2029-08-01',
        processedDate: '2026-08-01',
        submittedAt: CREATED_AT,
        reviewedAt: null,
        supersededAt: null,
      },
      {
        id: 'sub-fa',
        reviewStatus: 'approved',
        expiryDate: '2029-08-01',
        processedDate: null,
        submittedAt: CREATED_AT,
        reviewedAt: CREATED_AT,
        supersededAt: null,
      },
      {
        id: 'sub-imm',
        reviewStatus: 'approved',
        expiryDate: null,
        processedDate: null,
        submittedAt: CREATED_AT,
        reviewedAt: CREATED_AT,
        supersededAt: null,
      },
    ];

    const metadata = await harness.service.getMetadata(req);
    expect(metadata.documents.map((doc) => doc.documentType)).toEqual(['first_aid_cpr']);

    await expect(
      harness.service.streamFile(req, 'vulnerable_sector_check', FILE_VSC),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
  });

  it('hides expired documents on metadata and file requests', async () => {
    const harness = createHarness();
    const session = harness.shareService.signShareSession(STAFF_A_ID, CREATED_AT.getTime());
    const req = { cookies: { [STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME]: session } } as never;

    harness.state.submissions = harness.state.submissions.map((submission) =>
      submission.id === 'sub-vsc'
        ? { ...submission, expiryDate: '2020-01-01' }
        : submission,
    );

    const metadata = await harness.service.getMetadata(req);
    expect(metadata.documents.map((doc) => doc.documentType)).toEqual(['first_aid_cpr']);

    await expect(
      harness.service.streamFile(req, 'vulnerable_sector_check', FILE_VSC),
    ).rejects.toThrow(PUBLIC_STAFF_DOCUMENT_SHARE_UNAVAILABLE_MESSAGE);
  });
});
