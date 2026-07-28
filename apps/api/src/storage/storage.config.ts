/**
 * Server-side object storage configuration (DigitalOcean Spaces / S3-compatible).
 * All vars are optional at boot; required only when storage operations run.
 */
export interface ObjectStorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const STORAGE_ENV_KEYS = [
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_ACCESS_KEY',
  'OBJECT_STORAGE_SECRET_KEY',
  'OBJECT_STORAGE_REGION',
] as const;

export class ObjectStorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ObjectStorageConfigError';
  }
}

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Returns null when object storage is intentionally disabled (all vars empty). */
export function parseObjectStorageConfig(
  env: Record<string, unknown>,
): ObjectStorageConfig | null {
  const values = Object.fromEntries(
    STORAGE_ENV_KEYS.map((key) => [key, trim(env[key])]),
  ) as Record<(typeof STORAGE_ENV_KEYS)[number], string>;

  const present = STORAGE_ENV_KEYS.filter((key) => values[key] !== '');
  if (present.length === 0) return null;

  const missing = STORAGE_ENV_KEYS.filter((key) => values[key] === '');
  if (missing.length > 0) {
    throw new ObjectStorageConfigError(
      `Incomplete object storage configuration. Missing: ${missing.join(', ')}`,
    );
  }

  let endpoint = values.OBJECT_STORAGE_ENDPOINT;
  if (!/^https?:\/\//i.test(endpoint)) {
    endpoint = `https://${endpoint}`;
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket: values.OBJECT_STORAGE_BUCKET,
    accessKeyId: values.OBJECT_STORAGE_ACCESS_KEY,
    secretAccessKey: values.OBJECT_STORAGE_SECRET_KEY,
    region: values.OBJECT_STORAGE_REGION,
  };
}

export function validateObjectStorageConfig(config: ObjectStorageConfig): void {
  if (!config.bucket || /[/\\]/.test(config.bucket)) {
    throw new ObjectStorageConfigError('OBJECT_STORAGE_BUCKET must be a plain bucket name.');
  }
  if (!config.region) {
    throw new ObjectStorageConfigError('OBJECT_STORAGE_REGION is required.');
  }
  try {
    new URL(config.endpoint);
  } catch {
    throw new ObjectStorageConfigError('OBJECT_STORAGE_ENDPOINT must be a valid URL.');
  }
}
