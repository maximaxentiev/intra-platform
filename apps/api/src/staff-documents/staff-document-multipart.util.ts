import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { MulterError } from 'multer';
import { STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION } from './staff-document-validation.util';
import { createStaffDocumentAggregateLimitedStorage } from './staff-document-multipart.storage';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function staffDocumentUploadInterceptor() {
  return AnyFilesInterceptor({
    storage: createStaffDocumentAggregateLimitedStorage(),
    limits: {
      files: STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION,
      fieldSize: 64 * 1024,
      fields: 12,
    },
  });
}

export function mapStaffDocumentMulterError(err: unknown): never {
  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_COUNT'
        ? `At most ${STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION} files may be uploaded per request.`
        : err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FIELD_VALUE'
          ? 'Upload exceeds the 50 MB limit.'
          : 'Invalid file upload.';
    throw new PayloadTooLargeException(message);
  }
  throw err;
}

/** Parse retainFileIds from multipart form field (JSON array of UUID strings). */
export function parseRetainFileIds(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];

  let parsed: unknown;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadRequestException('retainFileIds must be a JSON array of file IDs.');
    }
  } else if (Array.isArray(raw)) {
    parsed = raw;
  } else {
    throw new BadRequestException('retainFileIds must be a JSON array of file IDs.');
  }

  if (!Array.isArray(parsed)) {
    throw new BadRequestException('retainFileIds must be a JSON array of file IDs.');
  }

  const ids = parsed.map((value) => String(value).trim()).filter(Boolean);
  if (ids.length !== parsed.length) {
    throw new BadRequestException('retainFileIds must not contain empty values.');
  }

  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw new BadRequestException('retainFileIds must not contain duplicates.');
  }

  for (const id of unique) {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException(`Invalid retainFileIds entry: ${id}.`);
    }
  }

  return unique;
}

/** Filter uploaded files to the "files" field (supports AnyFilesInterceptor). */
export function pickNewDocumentFiles(files: Express.Multer.File[] | undefined): Express.Multer.File[] {
  if (!files?.length) return [];
  return files.filter((file) => file.fieldname === 'files' || file.fieldname === 'files[]');
}
