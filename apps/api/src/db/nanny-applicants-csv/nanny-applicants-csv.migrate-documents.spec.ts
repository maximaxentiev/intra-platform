import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { migrateHistoricalDocumentsForApplication } from './nanny-applicants-csv.migrate-documents';
import type { MappedHistoricalRow } from './nanny-applicants-csv.map';

function mockRow(overrides: Partial<MappedHistoricalRow> = {}): MappedHistoricalRow {
  const sourceRowId = randomUUID();
  return {
    sourceRowId,
    externalSubmissionId: `fillout-historical-nanny:${sourceRowId}`,
    rowNumber: 2,
    normalizationFlags: [],
    blocked: false,
    blockReasons: [],
    payload: {
      role: 'Nanny',
      intakeVersion: 'historical_import',
      import: {
        sourceSystem: 'fillout',
        exportKind: 'grid-view-csv',
        payloadVersion: 'historical-nanny-import-v1',
        sourceRowId,
        sourceRaw: {},
        originalSubmissionTimestampAvailable: false,
        originalSubmissionTimestamp: null,
      },
      applicant: {},
      eligibility: {},
      experience: {},
      qualifications: {},
      compliance: {},
      languages: {},
      documents: {
        resume: {
          referenceKind: 'https_url',
          sourceUrl: 'https://example.test/resume.pdf',
          suggestedFilename: 'resume.pdf',
        },
        vsc: { referenceKind: 'empty', sourceUrl: null, suggestedFilename: null },
      },
    },
    ...overrides,
  };
}

describe('migrateHistoricalDocumentsForApplication', () => {
  it('skips resume when already stored', async () => {
    const applicationId = randomUUID();
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ category: 'resume' }]),
        })),
      })),
      insert: vi.fn(),
    } as never;
    const storage = { uploadObject: vi.fn() } as never;
    const fetchImpl = vi.fn();
    const result = await migrateHistoricalDocumentsForApplication(
      db,
      storage,
      applicationId,
      mockRow(),
      fetchImpl,
    );
    expect(result.resume).toBe('skipped_existing');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });

  it('creates resume when not yet stored', async () => {
    const applicationId = randomUUID();
    const pdf = Buffer.from('%PDF-1.4\n');
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    } as never;
    const storage = { uploadObject: vi.fn(async () => ({ key: 'applications/x/y/z.pdf' })) } as never;
    const fetchImpl = vi.fn(async () => new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    const result = await migrateHistoricalDocumentsForApplication(
      db,
      storage,
      applicationId,
      mockRow(),
      fetchImpl,
    );
    expect(result.resume).toBe('created');
    expect(storage.uploadObject).toHaveBeenCalled();
  });

  it('retries VSC when resume exists but VSC not yet stored', async () => {
    const applicationId = randomUUID();
    const pdf = Buffer.from('%PDF-1.4\n');
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [{ category: 'resume' }]),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    } as never;
    const storage = { uploadObject: vi.fn(async () => ({ key: 'applications/x/y/z.pdf' })) } as never;
    const fetchImpl = vi.fn(async () => new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    const row = mockRow({
      payload: {
        ...mockRow().payload,
        documents: {
          resume: {
            referenceKind: 'https_url',
            sourceUrl: 'https://example.test/r.pdf',
            suggestedFilename: 'r.pdf',
          },
          vsc: {
            referenceKind: 'https_url',
            sourceUrl: 'https://example.test/v.pdf',
            suggestedFilename: 'v.pdf',
          },
        },
      },
    });
    const result = await migrateHistoricalDocumentsForApplication(
      db,
      storage,
      applicationId,
      row,
      fetchImpl,
    );
    expect(result.resume).toBe('skipped_existing');
    expect(result.vsc).toBe('created');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not delete storage when upload and DB insert succeed', async () => {
    const applicationId = randomUUID();
    const pdf = Buffer.from('%PDF-1.4\n');
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    } as never;
    const deleteObject = vi.fn();
    const storage = {
      uploadObject: vi.fn(async () => ({ key: 'applications/x/y/z.pdf' })),
      deleteObject,
    } as never;
    const fetchImpl = vi.fn(async () => new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    await migrateHistoricalDocumentsForApplication(db, storage, applicationId, mockRow(), fetchImpl);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('attempts orphan cleanup when upload succeeds but DB insert fails', async () => {
    const applicationId = randomUUID();
    const pdf = Buffer.from('%PDF-1.4\n');
    const uploadedKey = 'applications/new-doc/resume.pdf';
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {
          throw new Error('db insert failed');
        }),
      })),
    } as never;
    const deleteObject = vi.fn(async () => undefined);
    const storage = {
      uploadObject: vi.fn(async (args: { key: string }) => {
        expect(args.key).toBeTruthy();
        return { key: args.key };
      }),
      deleteObject,
    } as never;
    const fetchImpl = vi.fn(async () => new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    await expect(
      migrateHistoricalDocumentsForApplication(db, storage, applicationId, mockRow(), fetchImpl),
    ).rejects.toThrow('db insert failed');
    expect(storage.uploadObject).toHaveBeenCalledTimes(1);
    const key = (storage.uploadObject as ReturnType<typeof vi.fn>).mock.calls[0]![0].key as string;
    expect(deleteObject).toHaveBeenCalledWith(key);
  });

  it('surfaces DB insert failure when orphan cleanup also fails', async () => {
    const applicationId = randomUUID();
    const pdf = Buffer.from('%PDF-1.4\n');
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => []),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async () => {
          throw new Error('db insert failed');
        }),
      })),
    } as never;
    const logger = { warn: vi.fn() };
    const storage = {
      uploadObject: vi.fn(async (args: { key: string }) => ({ key: args.key })),
      deleteObject: vi.fn(async () => {
        throw new Error('delete failed');
      }),
    } as never;
    const fetchImpl = vi.fn(async () => new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } }));
    await expect(
      migrateHistoricalDocumentsForApplication(db, storage, applicationId, mockRow(), fetchImpl, logger),
    ).rejects.toThrow('db insert failed');
    expect(logger.warn).toHaveBeenCalledWith(
      '[historical-nanny-import] orphan object cleanup failed after document row insert error',
    );
  });
});
