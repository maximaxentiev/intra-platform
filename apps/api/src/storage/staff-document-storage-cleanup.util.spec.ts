import { describe, expect, it, vi } from 'vitest';
import {
  assertStaffDocumentStorageDeleteSucceeded,
  deleteStaffDocumentStorageKeys,
} from './staff-document-storage-cleanup.util';

const STAFF_KEY = 'staff/11111111-1111-4111-8111-111111111111/sub/file.pdf';
const APP_KEY = 'applications/11111111-1111-4111-8111-111111111111/doc/file.pdf';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
    destroy: vi.fn(),
  })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => input),
}));

describe('deleteStaffDocumentStorageKeys', () => {
  const env = {
    OBJECT_STORAGE_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
    OBJECT_STORAGE_BUCKET: 'test-bucket',
    OBJECT_STORAGE_ACCESS_KEY: 'key',
    OBJECT_STORAGE_SECRET_KEY: 'secret',
    OBJECT_STORAGE_REGION: 'nyc3',
  };

  it('deletes staff/ keys only', async () => {
    const result = await deleteStaffDocumentStorageKeys([STAFF_KEY, APP_KEY], env);
    expect(result.deleted).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.message).toMatch(/non-staff/i);
  });

  it('throws when any staff key deletion fails', () => {
    expect(() =>
      assertStaffDocumentStorageDeleteSucceeded(
        { deleted: 0, failures: [{ key: STAFF_KEY, message: 'network error' }] },
        1,
      ),
    ).toThrow(/object cleanup failed/i);
  });
});
