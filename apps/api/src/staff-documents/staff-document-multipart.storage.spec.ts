import { Readable } from 'stream';
import { describe, expect, it } from 'vitest';
import { MulterError } from 'multer';
import {
  createStaffDocumentAggregateLimitedStorage,
  getStaffDocumentUploadState,
} from './staff-document-multipart.storage';
import {
  STAFF_DOCUMENT_MAX_FILE_BYTES,
  STAFF_DOCUMENT_MAX_SUBMISSION_BYTES,
} from './staff-document-validation.util';

function streamFromChunks(chunks: Buffer[]): Readable {
  return Readable.from(chunks);
}

function mockFile(stream: Readable, fieldname = 'files') {
  return {
    fieldname,
    originalname: 'test.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    stream,
  };
}

describe('aggregate-limited multipart storage', () => {
  it('accepts files within per-file and aggregate limits', async () => {
    const storage = createStaffDocumentAggregateLimitedStorage();
    const req = {} as import('express').Request;
    const chunk = Buffer.alloc(1024);

    await new Promise<void>((resolve, reject) => {
      storage._handleFile(req, mockFile(streamFromChunks([chunk])) as never, (err, info) => {
        if (err) return reject(err);
        expect((info as { buffer: Buffer }).buffer.length).toBe(1024);
        resolve();
      });
    });

    const state = getStaffDocumentUploadState(req);
    expect(state.fileCount).toBe(1);
    expect(state.completedBytes).toBe(1024);
  });

  it('rejects individual files larger than 50 MB during streaming', async () => {
    const storage = createStaffDocumentAggregateLimitedStorage();
    const req = {} as import('express').Request;
    const tooLarge = Buffer.alloc(STAFF_DOCUMENT_MAX_FILE_BYTES + 1);

    await expect(
      new Promise((resolve, reject) => {
        storage._handleFile(req, mockFile(streamFromChunks([tooLarge])) as never, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        });
      }),
    ).rejects.toBeInstanceOf(MulterError);
  });

  it('stops aggregate ingestion beyond 50 MB without buffering a second full file', async () => {
    const storage = createStaffDocumentAggregateLimitedStorage();
    const req = {} as import('express').Request;
    const first = Buffer.alloc(Math.floor(STAFF_DOCUMENT_MAX_SUBMISSION_BYTES * 0.6));
    const second = Buffer.alloc(Math.floor(STAFF_DOCUMENT_MAX_SUBMISSION_BYTES * 0.6));

    await new Promise<void>((resolve, reject) => {
      storage._handleFile(req, mockFile(streamFromChunks([first])) as never, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await expect(
      new Promise((resolve, reject) => {
        storage._handleFile(req, mockFile(streamFromChunks([second])) as never, (err, info) => {
          if (err) return reject(err);
          resolve(info);
        });
      }),
    ).rejects.toBeInstanceOf(MulterError);

    const state = getStaffDocumentUploadState(req);
    expect(state.aborted).toBe(true);
    expect(state.completedBytes).toBeLessThanOrEqual(STAFF_DOCUMENT_MAX_SUBMISSION_BYTES);
  });
});
