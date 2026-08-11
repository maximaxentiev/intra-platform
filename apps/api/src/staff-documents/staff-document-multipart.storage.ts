import type { Request } from 'express';
import { MulterError, type StorageEngine } from 'multer';
import {
  STAFF_DOCUMENT_MAX_FILE_BYTES,
  STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION,
  STAFF_DOCUMENT_MAX_SUBMISSION_BYTES,
} from './staff-document-validation.util';

/** Request-scoped upload counters shared across files in one multipart request. */
export const STAFF_DOCUMENT_UPLOAD_STATE = Symbol('staffDocumentUploadState');

export interface StaffDocumentUploadState {
  fileCount: number;
  completedBytes: number;
  aborted: boolean;
  abortReason?: string;
}

export function getStaffDocumentUploadState(req: Request): StaffDocumentUploadState {
  const extended = req as Request & {
    [STAFF_DOCUMENT_UPLOAD_STATE]?: StaffDocumentUploadState;
  };
  if (!extended[STAFF_DOCUMENT_UPLOAD_STATE]) {
    extended[STAFF_DOCUMENT_UPLOAD_STATE] = {
      fileCount: 0,
      completedBytes: 0,
      aborted: false,
    };
  }
  return extended[STAFF_DOCUMENT_UPLOAD_STATE]!;
}

/**
 * In-memory Multer storage that enforces aggregate byte limits while streaming each file.
 *
 * How aggregate enforcement works:
 * - A request-level counter tracks completed file bytes and file count.
 * - While consuming each file stream, bytes are accumulated incrementally.
 * - Before accepting another chunk, we check:
 *   - per-file bytes <= 50 MB
 *   - completedBytes + currentFileBytes <= 50 MB total for this request
 * - On violation the stream is drained, the request is marked aborted, and Multer fails fast.
 * - Subsequent files in the same request are rejected immediately without buffering.
 *
 * Retained files from prior submissions are NOT part of multipart ingestion; their sizes are
 * validated separately in the service against DB metadata before save.
 */
export function createStaffDocumentAggregateLimitedStorage(): StorageEngine {
  return {
    _handleFile(req, file, cb) {
      const state = getStaffDocumentUploadState(req);

      if (state.aborted) {
        file.stream.resume();
        cb(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
        return;
      }

      if (state.fileCount >= STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION) {
        state.aborted = true;
        state.abortReason = 'Too many files in upload.';
        file.stream.resume();
        cb(new MulterError('LIMIT_FILE_COUNT'));
        return;
      }

      const chunks: Buffer[] = [];
      let fileBytes = 0;

      const abort = (code: 'LIMIT_FILE_SIZE' | 'LIMIT_FIELD_VALUE' | 'LIMIT_FILE_COUNT', message: string) => {
        if (!state.aborted) {
          state.aborted = true;
          state.abortReason = message;
        }
        file.stream.removeAllListeners('data');
        file.stream.resume();
        cb(new MulterError(code, file.fieldname));
      };

      file.stream.on('data', (chunk: Buffer) => {
        if (state.aborted) return;

        fileBytes += chunk.length;
        const projectedTotal = state.completedBytes + fileBytes;

        if (fileBytes > STAFF_DOCUMENT_MAX_FILE_BYTES) {
          abort('LIMIT_FILE_SIZE', 'Individual file exceeds 50 MB.');
          return;
        }
        if (projectedTotal > STAFF_DOCUMENT_MAX_SUBMISSION_BYTES) {
          abort('LIMIT_FIELD_VALUE', 'Combined upload exceeds 50 MB.');
          return;
        }

        chunks.push(chunk);
      });

      file.stream.on('error', (err) => {
        if (!state.aborted) cb(err);
      });

      file.stream.on('end', () => {
        if (state.aborted) return;

        const buffer = Buffer.concat(chunks);
        state.fileCount += 1;
        state.completedBytes += buffer.length;

        cb(null, { buffer });
      });
    },

    _removeFile(_req, _file, cb) {
      cb(null);
    },
  };
}
