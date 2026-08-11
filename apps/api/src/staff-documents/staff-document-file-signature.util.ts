import { StaffDocumentValidationError } from './staff-document-validation.util';

export type StaffDocumentContentKind = 'pdf' | 'png' | 'jpeg';

const PDF_SIGNATURE = Buffer.from('%PDF');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

function extensionOf(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot).toLowerCase();
}

function normalizeMime(contentType: string): string {
  return contentType.split(';')[0]?.trim().toLowerCase() ?? '';
}

function kindFromExtension(ext: string): StaffDocumentContentKind | null {
  if (ext === '.pdf') return 'pdf';
  if (ext === '.png') return 'png';
  if (ext === '.jpg' || ext === '.jpeg') return 'jpeg';
  return null;
}

function kindFromMime(mime: string): StaffDocumentContentKind | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpeg';
  return null;
}

/** Detect content kind from magic bytes — do not trust extension or MIME alone. */
export function detectStaffDocumentContentKind(buffer: Buffer): StaffDocumentContentKind | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(PDF_SIGNATURE.subarray(0, 4))) {
    return 'pdf';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(JPEG_SIGNATURE)) {
    return 'jpeg';
  }
  return null;
}

export interface StaffDocumentFileContentInput {
  originalFilename: string;
  contentType: string;
  buffer: Buffer;
}

/**
 * Validates extension, claimed MIME, and file signature against the actual buffer.
 * JPG and JPEG both map to JPEG content.
 */
export function validateStaffDocumentFileContent(input: StaffDocumentFileContentInput): void {
  const ext = extensionOf(input.originalFilename);
  const mime = normalizeMime(input.contentType);
  const extKind = kindFromExtension(ext);
  const mimeKind = kindFromMime(mime);
  const bufferKind = detectStaffDocumentContentKind(input.buffer);

  if (!extKind) {
    throw new StaffDocumentValidationError(
      `File extension "${ext || '(none)'}" is not allowed for staff documents.`,
    );
  }
  if (!mimeKind) {
    throw new StaffDocumentValidationError(`MIME type "${input.contentType}" is not allowed.`);
  }
  if (!bufferKind) {
    throw new StaffDocumentValidationError('File content does not match an allowed document format.');
  }
  if (extKind !== mimeKind || extKind !== bufferKind) {
    throw new StaffDocumentValidationError(
      'File extension, MIME type, and content signature do not match.',
    );
  }
}
