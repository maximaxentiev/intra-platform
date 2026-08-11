import {
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { parseObjectStorageConfig, type ObjectStorageConfig } from './storage.config';
import { isStaffDocumentStorageKey } from './storage-key.util';

export interface StaffDocumentStorageDeleteResult {
  deleted: number;
  failures: Array<{ key: string; message: string }>;
}

function createS3Client(config: ObjectStorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: false,
  });
}

/**
 * Delete staff document objects only — never touches applications/ keys.
 * Used by staging cleanup before Staff DB rows are removed.
 */
export async function deleteStaffDocumentStorageKeys(
  keys: string[],
  env: Record<string, unknown>,
): Promise<StaffDocumentStorageDeleteResult> {
  const config = parseObjectStorageConfig(env);
  if (!config) {
    throw new Error('Object storage is not configured — cannot delete staff document objects.');
  }

  const uniqueKeys = [...new Set(keys.filter((key) => isStaffDocumentStorageKey(key)))];
  const client = createS3Client(config);
  const failures: Array<{ key: string; message: string }> = [];
  let deleted = 0;

  for (const key of uniqueKeys) {
    if (!isStaffDocumentStorageKey(key)) {
      failures.push({ key, message: 'Refusing to delete non-staff storage key.' });
      continue;
    }

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
      deleted += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 300) : 'unknown error';
      failures.push({ key, message });
    }
  }

  client.destroy();
  return { deleted, failures };
}

export function assertStaffDocumentStorageDeleteSucceeded(
  result: StaffDocumentStorageDeleteResult,
  totalKeys: number,
): void {
  if (result.failures.length > 0) {
    const detail = result.failures
      .slice(0, 5)
      .map((f) => `${f.key}: ${f.message}`)
      .join('; ');
    throw new Error(
      `Staff document object cleanup failed (${result.failures.length}/${totalKeys}): ${detail}`,
    );
  }
}
