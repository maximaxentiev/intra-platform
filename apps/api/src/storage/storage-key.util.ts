const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_FILENAME_LENGTH = 180;
const MAX_KEY_LENGTH = 1024;

/** Strip path components and unsafe characters from an uploaded filename. */
export function sanitizeFilename(originalFilename: string): string {
  const base = originalFilename.replace(/\\/g, '/').split('/').pop() ?? '';
  const stripped = base
    .replace(/\0/g, '')
    .replace(/[^\w.\-()+\s]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');

  const safe = stripped.slice(0, MAX_FILENAME_LENGTH);
  return safe.length > 0 ? safe : 'document';
}

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`${label} must be a valid UUID.`);
  }
}

/** Reject keys that could escape the intended prefix or bucket layout. */
export function assertSafeStorageKey(key: string): void {
  if (!key || key.length > MAX_KEY_LENGTH) {
    throw new Error('Storage key is missing or too long.');
  }
  if (key.startsWith('/') || key.includes('..') || key.includes('\\')) {
    throw new Error('Storage key contains invalid path segments.');
  }
  if (!key.startsWith('applications/')) {
    throw new Error('Storage key must live under the applications/ prefix.');
  }
}

export function buildApplicationDocumentKey(input: {
  applicationId: string;
  documentId: string;
  originalFilename: string;
}): string {
  assertUuid(input.applicationId, 'applicationId');
  assertUuid(input.documentId, 'documentId');
  const filename = sanitizeFilename(input.originalFilename);
  const key = `applications/${input.applicationId}/${input.documentId}/${filename}`;
  assertSafeStorageKey(key);
  return key;
}
