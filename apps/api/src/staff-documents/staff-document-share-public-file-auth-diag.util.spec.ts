import { describe, expect, it } from 'vitest';
import { STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH } from './staff-document-share.constants';
import { isRequestPathWithinShareSessionCookiePath } from './staff-document-share-session.util';

describe('share session cookie path coverage', () => {
  it('covers metadata and nested file content routes', () => {
    const cookiePath = STAFF_DOCUMENT_SHARE_SESSION_COOKIE_PATH;
    expect(cookiePath).toBe('/api/v1/public/staff-documents/share');

    const metadataPath = '/api/v1/public/staff-documents/share';
    const filePath =
      '/api/v1/public/staff-documents/share/vulnerable_sector_check/files/11111111-1111-4111-8111-111111111111/content';

    expect(isRequestPathWithinShareSessionCookiePath(metadataPath, cookiePath)).toBe(true);
    expect(isRequestPathWithinShareSessionCookiePath(filePath, cookiePath)).toBe(true);
    expect(
      isRequestPathWithinShareSessionCookiePath('/api/v1/public/staff-documents', cookiePath),
    ).toBe(false);
  });
});
