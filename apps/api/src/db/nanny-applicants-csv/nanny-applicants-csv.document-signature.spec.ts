import { describe, expect, it } from 'vitest';
import { detectHistoricalDocument } from './nanny-applicants-csv.document-signature';

describe('detectHistoricalDocument', () => {
  it('detects PDF resume', () => {
    const buf = Buffer.from('%PDF-1.4\n');
    const d = detectHistoricalDocument(buf, 'application/octet-stream', 'resume');
    expect(d.category).toBe('resume');
    if (d.category === 'resume') expect(d.format).toBe('pdf');
  });

  it('rejects HTML masquerade', () => {
    const buf = Buffer.from('<!DOCTYPE html><html></html>');
    const d = detectHistoricalDocument(buf, 'text/html', 'resume');
    expect(d.category).toBe('html_error');
  });

  it('detects JPEG for VSC', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    const d = detectHistoricalDocument(buf, 'application/octet-stream', 'vsc');
    expect(d.category).toBe('vsc');
  });

  it('rejects JPEG for resume', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const d = detectHistoricalDocument(buf, 'image/jpeg', 'resume');
    expect(d.category).toBe('unsupported');
  });
});
