import { describe, expect, it, vi } from 'vitest';
import { applyPublicStaffDocumentShareHeaders } from './staff-document-share-public-headers.util';

describe('applyPublicStaffDocumentShareHeaders', () => {
  it('sets required security headers on public share responses', () => {
    const headers = new Map<string, string>();
    const res = {
      setHeader: vi.fn((name: string, value: string) => {
        headers.set(name.toLowerCase(), value);
      }),
    };

    applyPublicStaffDocumentShareHeaders(res as never);

    expect(headers.get('cache-control')).toBe('private, no-store');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-robots-tag')).toBe('noindex, nofollow, noarchive');
  });
});
