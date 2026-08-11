import {
  STAFF_DOCUMENT_TYPE_VALUES,
  type StaffDocumentType,
} from './staff-document.constants';

export const STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION = 10;
export const STAFF_DOCUMENT_MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB per file
export const STAFF_DOCUMENT_MAX_SUBMISSION_BYTES = 50 * 1024 * 1024; // 50 MB total per category

export const STAFF_DOCUMENT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);

export const STAFF_DOCUMENT_ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

export interface StaffDocumentFileCandidate {
  originalFilename: string;
  contentType: string;
  byteSize: number;
}

export class StaffDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffDocumentValidationError';
  }
}

function extensionOf(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot).toLowerCase();
}

function normalizeMime(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

export function assertStaffDocumentType(value: string): StaffDocumentType {
  if (!(STAFF_DOCUMENT_TYPE_VALUES as readonly string[]).includes(value)) {
    throw new StaffDocumentValidationError(`Invalid staff document type: ${value}.`);
  }
  return value as StaffDocumentType;
}

export function validateStaffDocumentFileCandidate(file: StaffDocumentFileCandidate): void {
  const ext = extensionOf(file.originalFilename);
  if (!STAFF_DOCUMENT_ALLOWED_EXTENSIONS.has(ext)) {
    throw new StaffDocumentValidationError(
      `File extension "${ext || '(none)'}" is not allowed for staff documents.`,
    );
  }

  const mime = normalizeMime(file.contentType);
  if (!STAFF_DOCUMENT_ALLOWED_MIME_TYPES.has(mime)) {
    throw new StaffDocumentValidationError(`MIME type "${file.contentType}" is not allowed.`);
  }

  if (file.byteSize <= 0) {
    throw new StaffDocumentValidationError('File is empty.');
  }

  if (file.byteSize > STAFF_DOCUMENT_MAX_FILE_BYTES) {
    throw new StaffDocumentValidationError(
      `File exceeds the ${STAFF_DOCUMENT_MAX_FILE_BYTES} byte limit.`,
    );
  }
}

/** Validates count, per-file rules, and combined byte total for a submission batch. */
export function validateStaffDocumentSubmissionFiles(files: StaffDocumentFileCandidate[]): void {
  if (files.length === 0) {
    throw new StaffDocumentValidationError('At least one file is required.');
  }

  if (files.length > STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION) {
    throw new StaffDocumentValidationError(
      `A document category may include at most ${STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION} files.`,
    );
  }

  let total = 0;
  for (const file of files) {
    validateStaffDocumentFileCandidate(file);
    total += file.byteSize;
  }

  if (total > STAFF_DOCUMENT_MAX_SUBMISSION_BYTES) {
    throw new StaffDocumentValidationError(
      `Combined file size exceeds the ${STAFF_DOCUMENT_MAX_SUBMISSION_BYTES} byte limit.`,
    );
  }
}
