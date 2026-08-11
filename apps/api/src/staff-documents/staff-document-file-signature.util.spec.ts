import { describe, expect, it } from 'vitest';
import {
  detectStaffDocumentContentKind,
  validateStaffDocumentFileContent,
} from './staff-document-file-signature.util';
import { StaffDocumentValidationError } from './staff-document-validation.util';

const PDF_BYTES = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(16, 0)]);
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

describe('staff document file signatures', () => {
  it('accepts valid PDF magic + MIME + extension', () => {
    expect(() =>
      validateStaffDocumentFileContent({
        originalFilename: 'report.pdf',
        contentType: 'application/pdf',
        buffer: PDF_BYTES,
      }),
    ).not.toThrow();
    expect(detectStaffDocumentContentKind(PDF_BYTES)).toBe('pdf');
  });

  it('accepts valid PNG', () => {
    expect(() =>
      validateStaffDocumentFileContent({
        originalFilename: 'scan.png',
        contentType: 'image/png',
        buffer: PNG_BYTES,
      }),
    ).not.toThrow();
  });

  it('accepts valid JPG and JPEG', () => {
    for (const name of ['photo.jpg', 'photo.jpeg']) {
      expect(() =>
        validateStaffDocumentFileContent({
          originalFilename: name,
          contentType: 'image/jpeg',
          buffer: JPEG_BYTES,
        }),
      ).not.toThrow();
    }
  });

  it('rejects fake PDF text content', () => {
    expect(() =>
      validateStaffDocumentFileContent({
        originalFilename: 'fake.pdf',
        contentType: 'application/pdf',
        buffer: Buffer.from('not a pdf'),
      }),
    ).toThrow(StaffDocumentValidationError);
  });

  it('rejects renamed executable as jpg', () => {
    expect(() =>
      validateStaffDocumentFileContent({
        originalFilename: 'malware.jpg',
        contentType: 'image/jpeg',
        buffer: Buffer.from('MZ'),
      }),
    ).toThrow(/allowed document format/i);
  });

  it('rejects MIME mismatch', () => {
    expect(() =>
      validateStaffDocumentFileContent({
        originalFilename: 'file.pdf',
        contentType: 'image/png',
        buffer: PDF_BYTES,
      }),
    ).toThrow(/do not match/i);
  });
});
