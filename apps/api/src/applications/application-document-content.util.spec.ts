import { describe, expect, it } from 'vitest';
import {
  buildContentDisposition,
  isInlinePreviewContentType,
  sanitizeDownloadFilename,
} from './application-document-content.util';

describe('application document content util', () => {
  it('sanitizes unsafe filename characters', () => {
    expect(sanitizeDownloadFilename('../secret/vsc.pdf')).toBe('.._secret_vsc.pdf');
    expect(sanitizeDownloadFilename('')).toBe('document');
  });

  it('detects inline preview types', () => {
    expect(isInlinePreviewContentType('application/pdf', 'report.pdf')).toBe(true);
    expect(isInlinePreviewContentType('image/png', 'logo.png')).toBe(true);
    expect(isInlinePreviewContentType('image/jpeg', 'photo.jpg')).toBe(true);
    expect(
      isInlinePreviewContentType(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'file.docx',
      ),
    ).toBe(false);
  });

  it('rejects Word documents even when content type is ambiguous', () => {
    expect(isInlinePreviewContentType('application/octet-stream', 'file.docx')).toBe(false);
    expect(isInlinePreviewContentType('application/msword', 'file.doc')).toBe(false);
  });

  it('builds inline and attachment disposition headers', () => {
    expect(buildContentDisposition('VSC Report.pdf', true)).toBe('inline; filename="VSC Report.pdf"');
    expect(buildContentDisposition('notes.docx', false)).toBe('attachment; filename="notes.docx"');
  });
});
