import { describe, expect, it } from 'vitest';
import {
  assertSafeStorageKey,
  buildApplicationDocumentKey,
  sanitizeFilename,
} from './storage-key.util';

const APP_ID = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';

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
