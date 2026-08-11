import { describe, expect, it } from 'vitest';
import {
  STAFF_DOCUMENT_MAX_FILE_BYTES,
  STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION,
  STAFF_DOCUMENT_MAX_SUBMISSION_BYTES,
  validateStaffDocumentSubmissionFiles,
} from './staff-document-validation.util';

describe('validateStaffDocumentSubmissionFiles', () => {
  const pdf = {
    originalFilename: 'cert.pdf',
    contentType: 'application/pdf',
    byteSize: 1024,
  };

  it('accepts PDF, PNG, JPG, and JPEG', () => {
    expect(() => validateStaffDocumentSubmissionFiles([pdf])).not.toThrow();
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { originalFilename: 'a.png', contentType: 'image/png', byteSize: 100 },
      ]),
    ).not.toThrow();
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { originalFilename: 'a.jpg', contentType: 'image/jpeg', byteSize: 100 },
      ]),
    ).not.toThrow();
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { originalFilename: 'a.jpeg', contentType: 'image/jpg', byteSize: 100 },
      ]),
    ).not.toThrow();
  });

  it('rejects Word documents', () => {
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { originalFilename: 'doc.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 100 },
      ]),
    ).toThrow(/extension/i);
  });

  it('rejects files over 50 MB', () => {
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { ...pdf, byteSize: STAFF_DOCUMENT_MAX_FILE_BYTES + 1 },
      ]),
    ).toThrow(/byte limit/i);
  });

  it('rejects more than 10 files', () => {
    const files = Array.from({ length: STAFF_DOCUMENT_MAX_FILES_PER_SUBMISSION + 1 }, (_, i) => ({
      originalFilename: `f${i}.pdf`,
      contentType: 'application/pdf',
      byteSize: 100,
    }));
    expect(() => validateStaffDocumentSubmissionFiles(files)).toThrow(/at most 10 files/i);
  });

  it('rejects combined total over 50 MB', () => {
    const half = Math.floor(STAFF_DOCUMENT_MAX_SUBMISSION_BYTES / 2) + 1;
    expect(() =>
      validateStaffDocumentSubmissionFiles([
        { ...pdf, byteSize: half },
        { ...pdf, byteSize: half },
      ]),
    ).toThrow(/Combined file size/i);
  });
});
