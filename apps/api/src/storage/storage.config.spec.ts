import { describe, expect, it } from 'vitest';
import {
  ObjectStorageConfigError,
  parseObjectStorageConfig,
  validateObjectStorageConfig,
} from './storage.config';

describe('parseObjectStorageConfig', () => {
  it('returns null when all object storage env vars are empty', () => {
    expect(parseObjectStorageConfig({})).toBeNull();
    expect(
      parseObjectStorageConfig({
        OBJECT_STORAGE_ENDPOINT: '',
        OBJECT_STORAGE_BUCKET: '',
        OBJECT_STORAGE_ACCESS_KEY: '',
        OBJECT_STORAGE_SECRET_KEY: '',
        OBJECT_STORAGE_REGION: '',
      }),
    ).toBeNull();
  });

  it('parses a complete configuration and normalizes endpoint URL', () => {
    const config = parseObjectStorageConfig({
      OBJECT_STORAGE_ENDPOINT: 'nyc3.digitaloceanspaces.com',
      OBJECT_STORAGE_BUCKET: 'intra-application-documents',
      OBJECT_STORAGE_ACCESS_KEY: 'ACCESS',
      OBJECT_STORAGE_SECRET_KEY: 'SECRET',
      OBJECT_STORAGE_REGION: 'nyc3',
    });

    expect(config).toEqual({
      endpoint: 'https://nyc3.digitaloceanspaces.com',
      bucket: 'intra-application-documents',
      accessKeyId: 'ACCESS',
      secretAccessKey: 'SECRET',
      region: 'nyc3',
    });
  });

  it('throws when configuration is partially set', () => {
    expect(() =>
      parseObjectStorageConfig({
        OBJECT_STORAGE_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
        OBJECT_STORAGE_BUCKET: 'intra-application-documents',
      }),
    ).toThrow(ObjectStorageConfigError);
  });
});

describe('validateObjectStorageConfig', () => {
  it('rejects invalid bucket names and endpoints', () => {
    expect(() =>
      validateObjectStorageConfig({
        endpoint: 'not-a-url',
        bucket: 'bad/bucket',
        accessKeyId: 'a',
        secretAccessKey: 'b',
        region: 'nyc3',
      }),
    ).toThrow(ObjectStorageConfigError);
  });
});
