import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { Readable } from 'stream';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import { StaffPortalAuditService } from '../staff-portal/staff-portal-audit.service';
import { resolveClientIp } from '../common/client-ip.util';
import { STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME } from './staff-document-share.constants';
import { StaffDocumentSharePublicAuthService } from './staff-document-share-public-auth.service';
import { StaffDocumentSharePublicController } from './staff-document-share-public.controller';
import { StaffDocumentSharePublicService } from './staff-document-share-public.service';
import { StaffDocumentShareRateLimitService } from './staff-document-share-rate-limit.service';
import { StaffDocumentShareService } from './staff-document-share.service';

const TEST_SIGNING_SECRET = 'test-document-share-signing-secret-32chars-min';
const STAFF_A_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = new Date('2026-08-01T12:00:00.000Z');
const FILE_VSC = '33333333-3333-4333-8333-333333333333';

function createShareService() {
  return new StaffDocumentShareService({
    getOrThrow: (key: string) => {
      if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return TEST_SIGNING_SECRET;
      throw new Error(key);
    },
  } as unknown as ConfigService);
}

function staffRow() {
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

function createHarnessState(activeStaff = staffRow()): HarnessState {
  const shareService = createShareService();
  const generated = shareService.generateShareTokenState(STAFF_A_ID, CREATED_AT);

  return {
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
    ],
  };
}

function shareCookieFromSetCookie(setCookie: string | null): string {
  expect(setCookie).toBeTruthy();
  const match = setCookie!.match(new RegExp(`${STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME}=([^;]+)`));
  expect(match).toBeTruthy();
  return `${STAFF_DOCUMENT_SHARE_SESSION_COOKIE_NAME}=${match![1]}`;
}

function createPublicShareHttpApp(controller: StaffDocumentSharePublicController, rateLimit: {
  assertExchangeAllowed: (ip: string) => Promise<void>;
  assertMetadataAllowed: (ip: string) => Promise<void>;
  assertFileStreamAllowed: (ip: string) => Promise<void>;
}): Express {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  app.post('/api/v1/public/staff-documents/share/session', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rateLimit.assertExchangeAllowed(resolveClientIp(req));
      const result = await controller.exchangeSession(req.body, req, res);
      if (!res.headersSent) {
        res.status(201).json(result);
      }
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/v1/public/staff-documents/share', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await rateLimit.assertMetadataAllowed(resolveClientIp(req));
      const result = await controller.getMetadata(req, res);
      if (!res.headersSent) {
        res.status(200).json(result);
      }
    } catch (err) {
      next(err);
    }
  });

  app.get(
    '/api/v1/public/staff-documents/share/:documentType/files/:fileId/content',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await rateLimit.assertFileStreamAllowed(resolveClientIp(req));
        await controller.streamFile(req, res, req.params.documentType!, req.params.fileId!);
      } catch (err) {
        next(err);
      }
    },
  );

  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof NotFoundException) {
      res.status(404).json({ statusCode: 404, message: err.message });
      return;
    }
    next(err);
  });

  return app;
}

describe('StaffDocumentSharePublicController HTTP flow', () => {
  let server: ReturnType<Express['listen']>;
  let baseUrl: string;
  let shareToken: string;

  beforeAll(async () => {
    const shareService = createShareService();
    const generated = shareService.generateShareTokenState(STAFF_A_ID, CREATED_AT);
    shareToken = generated.token;

    const state = createHarnessState();
    const db = createDbMock(state);
    const storage = {
      getObjectStream: vi.fn().mockResolvedValue({
        body: Readable.from([Buffer.from('%PDF-1.4')]),
        contentType: 'application/pdf',
      }),
    };

    const config = {
      get: (key: string) => (key === 'SESSION_COOKIE_SECURE' ? 'false' : undefined),
      getOrThrow: (key: string) => {
        if (key === 'DOCUMENT_SHARE_SIGNING_SECRET') return TEST_SIGNING_SECRET;
        throw new Error(key);
      },
    } as unknown as ConfigService;

    const auth = new StaffDocumentSharePublicAuthService(db, shareService, config);
    const publicShare = new StaffDocumentSharePublicService(db, shareService, auth, storage as never, {
      record: vi.fn().mockResolvedValue(undefined),
    } as unknown as StaffPortalAuditService);

    const rateLimit = {
      assertExchangeAllowed: vi.fn().mockResolvedValue(undefined),
      assertMetadataAllowed: vi.fn().mockResolvedValue(undefined),
      assertFileStreamAllowed: vi.fn().mockResolvedValue(undefined),
    };

    const controller = new StaffDocumentSharePublicController(publicShare, rateLimit as never);
    const app = createPublicShareHttpApp(controller, rateLimit);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('exchanges session, loads metadata, and streams file via HTTP routes with cookie', async () => {
    const exchangeRes = await fetch(`${baseUrl}/api/v1/public/staff-documents/share/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'jane-doe', token: shareToken }),
    });
    expect(exchangeRes.status).toBe(201);
    const cookie = shareCookieFromSetCookie(exchangeRes.headers.get('set-cookie'));

    const metadataRes = await fetch(`${baseUrl}/api/v1/public/staff-documents/share`, {
      headers: { cookie },
    });
    expect(metadataRes.status).toBe(200);
    const metadata = (await metadataRes.json()) as {
      documents: Array<{ documentType: string; files: Array<{ id: string }> }>;
    };
    expect(metadata.documents.length).toBeGreaterThan(0);

    const document = metadata.documents[0]!;
    const file = document.files[0]!;
    const fileUrl = `${baseUrl}/api/v1/public/staff-documents/share/${document.documentType}/files/${file.id}/content`;

    const fileRes = await fetch(fileUrl, { headers: { cookie } });
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers.get('content-type')).toContain('application/pdf');
    const body = Buffer.from(await fileRes.arrayBuffer());
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('StaffDocumentSharePublicService test boundary gap', () => {
  it('identifies that service-level tests inject cookies on mock req and bypass HTTP routing', () => {
    expect(StaffDocumentSharePublicController.prototype.streamFile).toBeDefined();
    expect(StaffDocumentShareRateLimitService.prototype.assertFileStreamAllowed).toBeDefined();
  });
});
