import { describe, expect, it } from 'vitest';
import {
  assertSafeStorageKey,
  buildApplicationDocumentKey,
  buildStaffDocumentFileKey,
  isApplicationDocumentStorageKey,
  isStaffDocumentStorageKey,
  sanitizeFilename,
} from './storage-key.util';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';
const STAFF_ID = '33333333-3333-4333-8333-333333333333';
const SUBMISSION_ID = '44444444-4444-4444-8444-444444444444';
const FILE_ID = '55555555-5555-4555-8555-555555555555';

describe('sanitizeFilename', () => {
  it('removes path segments and unsafe characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\secret\\resume.pdf')).toBe('resume.pdf');
    expect(sanitizeFilename('  my file (1).pdf  ')).toBe('my file (1).pdf');
    expect(sanitizeFilename('')).toBe('document');
  });
});

describe('buildApplicationDocumentKey', () => {
  it('builds a predictable applications/{app}/{doc}/{filename} key', () => {
    expect(
      buildApplicationDocumentKey({
        applicationId: APP_ID,
        documentId: DOC_ID,
        originalFilename: 'VSC Scan.pdf',
      }),
    ).toBe(`applications/${APP_ID}/${DOC_ID}/VSC Scan.pdf`);
  });

  it('rejects invalid UUIDs and traversal keys', () => {
    expect(() =>
      buildApplicationDocumentKey({
        applicationId: 'not-a-uuid',
        documentId: DOC_ID,
        originalFilename: 'file.pdf',
      }),
    ).toThrow();

    expect(() => assertSafeStorageKey('applications/../secret/file.pdf')).toThrow();
    expect(() => assertSafeStorageKey('public/file.pdf')).toThrow();
  });
});

describe('buildStaffDocumentFileKey', () => {
  it('builds staff/{staff}/{submission}/{file}/{filename} keys', () => {
    const key = buildStaffDocumentFileKey({
      staffId: STAFF_ID,
      submissionId: SUBMISSION_ID,
      fileId: FILE_ID,
      originalFilename: 'vsc.pdf',
    });
    expect(key).toBe(`staff/${STAFF_ID}/${SUBMISSION_ID}/${FILE_ID}/vsc.pdf`);
    expect(isStaffDocumentStorageKey(key)).toBe(true);
    expect(isApplicationDocumentStorageKey(key)).toBe(false);
  });

  it('accepts applications/ and staff/ prefixes only', () => {
    expect(() =>
      assertSafeStorageKey(`applications/${APP_ID}/${DOC_ID}/file.pdf`),
    ).not.toThrow();
    expect(() =>
      assertSafeStorageKey(`staff/${STAFF_ID}/${SUBMISSION_ID}/${FILE_ID}/file.pdf`),
    ).not.toThrow();
    expect(() => assertSafeStorageKey('uploads/evil.pdf')).toThrow(/allowed prefix/i);
  });
});
