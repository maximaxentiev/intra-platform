import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Readable } from 'stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StorageNotConfiguredError,
  StorageOperationError,
} from '../storage/storage.service';
import { ApplicationsService } from './applications.service';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const sampleDocument = {
  id: DOC_ID,
  applicationId: APP_ID,
  category: 'vulnerable_sector_check' as const,
  originalFilename: 'vsc-report.pdf',
  contentType: 'application/pdf',
  byteSize: 128,
  storageKey: `applications/${APP_ID}/${DOC_ID}/vsc-report.pdf`,
  checksumSha256: 'abc',
  uploadedAt: new Date('2026-07-28T12:00:00Z'),
};

function createMockDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values: insertValues }));

  const appExistsChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: APP_ID }]),
  };

  const docChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([sampleDocument]),
  };

  let selectCall = 0;
  const db = {
    select: vi.fn(() => {
      selectCall += 1;
      return selectCall === 1 ? appExistsChain : docChain;
    }),
    insert,
  };

  return { db, insertValues, docChain };
}

describe('ApplicationsService document content', () => {
  let service: ApplicationsService;
  let db: ReturnType<typeof createMockDb>['db'];
  let insertValues: ReturnType<typeof createMockDb>['insertValues'];
  let docChain: ReturnType<typeof createMockDb>['docChain'];
  let storage: { getObjectStream: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    const mock = createMockDb();
    db = mock.db;
    insertValues = mock.insertValues;
    docChain = mock.docChain;
    storage = {
      getObjectStream: vi.fn().mockResolvedValue({
        body: Readable.from(Buffer.from('%PDF-1.4')),
        contentType: 'application/pdf',
        key: sampleDocument.storageKey,
        bucket: 'intra-application-documents',
      }),
    };
    service = new ApplicationsService(db as never, storage as never);
  });

  it('streams a document with inline disposition for PDF', async () => {
    const result = await service.streamDocumentContent(APP_ID, DOC_ID, USER_ID);

    expect(storage.getObjectStream).toHaveBeenCalledWith(sampleDocument.storageKey);
    expect(result.contentType).toBe('application/pdf');
    expect(result.contentDisposition).toBe('inline; filename="vsc-report.pdf"');
    expect(result.documentId).toBe(DOC_ID);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: APP_ID,
        actorUserId: USER_ID,
        actorType: 'ops_user',
        eventType: 'document_viewed',
        metadata: { documentId: DOC_ID, category: 'vulnerable_sector_check' },
      }),
    );
  });

  it('uses attachment disposition for Word documents', async () => {
    docChain.limit.mockResolvedValue([
      {
        ...sampleDocument,
        originalFilename: 'notes.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ]);

    const result = await service.streamDocumentContent(APP_ID, DOC_ID, USER_ID);
    expect(result.contentDisposition).toBe('attachment; filename="notes.docx"');
  });

  it('throws when application is missing', async () => {
    db.select = vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }));

    await expect(service.streamDocumentContent(APP_ID, DOC_ID, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when document is missing or not owned by application', async () => {
    docChain.limit.mockResolvedValue([]);

    await expect(service.streamDocumentContent(APP_ID, DOC_ID, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });

  it('maps storage failures to a controlled service error', async () => {
    storage.getObjectStream.mockRejectedValue(new StorageOperationError('Failed to read object'));

    await expect(service.streamDocumentContent(APP_ID, DOC_ID, USER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('maps missing storage configuration to a controlled service error', async () => {
    storage.getObjectStream.mockRejectedValue(new StorageNotConfiguredError());

    await expect(service.streamDocumentContent(APP_ID, DOC_ID, USER_ID)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
