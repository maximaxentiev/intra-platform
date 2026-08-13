import { describe, expect, it } from 'vitest';
import { buildStaffDocumentShareUrl } from './staff-document-share-url.util';

describe('buildStaffDocumentShareUrl', () => {
  it('uses APP_PUBLIC_URL with fragment token and encoded slug', () => {
    const url = buildStaffDocumentShareUrl(
      'https://platform.intra.ca/',
      'jane-doe',
      'abc123token',
    );
    expect(url).toBe('https://platform.intra.ca/documents/jane-doe#abc123token');
    expect(url).not.toContain('?');
    expect(url).not.toContain('abc123token/');
  });

  it('normalizes trailing slashes on the public base URL', () => {
    const url = buildStaffDocumentShareUrl('https://platform.intra.ca///', 'jane-doe', 'token');
    expect(url.startsWith('https://platform.intra.ca/documents/')).toBe(true);
  });
});
