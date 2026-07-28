import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  StorageNotConfiguredError,
  StorageOperationError,
  StorageService,
} from './storage.service';

const send = vi.fn();
const APP_ID = '11111111-1111-4111-8111-111111111111';
const DOC_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(() => ({ send })),
  PutObjectCommand: vi.fn((input) => ({ input, kind: 'put' })),
  GetObjectCommand: vi.fn((input) => ({ input, kind: 'get' })),
  DeleteObjectCommand: vi.fn((input) => ({ input, kind: 'delete' })),
  HeadBucketCommand: vi.fn((input) => ({ input, kind: 'head' })),
}));

function configuredConfigService(): ConfigService {
  return {
    get: (key: string) =>
      ({
        OBJECT_STORAGE_ENDPOINT: 'https://nyc3.digitaloceanspaces.com',
        OBJECT_STORAGE_BUCKET: 'intra-application-documents',
        OBJECT_STORAGE_ACCESS_KEY: 'test-access-key',
        OBJECT_STORAGE_SECRET_KEY: 'test-secret-key',
        OBJECT_STORAGE_REGION: 'nyc3',
      })[key],
  } as ConfigService;
}

describe('StorageService', () => {
  beforeEach(() => {
    send.mockReset();
  });

  it('reports missing configuration', () => {
    const service = new StorageService({ get: () => undefined } as ConfigService);
    expect(service.isConfigured()).toBe(false);
    expect(() => service.getConfigSummary()).not.toThrow();
    expect(service.getConfigSummary()).toEqual({ configured: false });
  });

  it('throws when operations run without configuration', async () => {
    const service = new StorageService({ get: () => undefined } as ConfigService);
    await expect(service.checkConnectivity()).rejects.toBeInstanceOf(StorageNotConfiguredError);
    await expect(
      service.uploadObject({
        key: `applications/${APP_ID}/${DOC_ID}/file.pdf`,
        body: Buffer.from('test'),
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(StorageNotConfiguredError);
  });

  it('uploads private objects with server-side content type', async () => {
    send.mockResolvedValue({});
    const service = new StorageService(configuredConfigService());
    const key = `applications/${APP_ID}/${DOC_ID}/file.pdf`;

    const result = await service.uploadObject({
      key,
      body: Buffer.from('hello'),
      contentType: 'application/pdf',
      metadata: { category: 'vulnerable_sector_check' },
    });

    expect(result.key).toBe(key);
    expect(result.contentType).toBe('application/pdf');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'intra-application-documents',
          Key: key,
          ACL: 'private',
          ContentType: 'application/pdf',
        }),
      }),
    );
  });

  it('wraps upload failures without leaking credentials', async () => {
    send.mockRejectedValue(new Error('AccessKeyId=test-access-key is invalid'));
    const service = new StorageService(configuredConfigService());

    await expect(
      service.uploadObject({
        key: `applications/${APP_ID}/${DOC_ID}/file.pdf`,
        body: Buffer.from('hello'),
        contentType: 'application/pdf',
      }),
    ).rejects.toBeInstanceOf(StorageOperationError);
  });

  it('checks connectivity with HeadBucket', async () => {
    send.mockResolvedValue({});
    const service = new StorageService(configuredConfigService());
    await expect(service.checkConnectivity()).resolves.toEqual({
      ok: true,
      bucket: 'intra-application-documents',
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: 'head' }));
  });

  it('deletes objects for rollback cleanup', async () => {
    send.mockResolvedValue({});
    const service = new StorageService(configuredConfigService());
    const key = `applications/${APP_ID}/${DOC_ID}/file.pdf`;
    await service.deleteObject(key);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Key: key }),
      }),
    );
  });
});
