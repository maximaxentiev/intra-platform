import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import {
  ObjectStorageConfigError,
  parseObjectStorageConfig,
  validateObjectStorageConfig,
  type ObjectStorageConfig,
} from './storage.config';
import { assertSafeStorageKey } from './storage-key.util';

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Object storage is not configured.');
    this.name = 'StorageNotConfiguredError';
  }
}

export class StorageOperationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageOperationError';
  }
}

export interface UploadObjectInput {
  /** Server-generated key only — never accept raw keys from public clients. */
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  bucket: string;
  contentType: string;
  byteSize?: number;
}

export interface ObjectStreamResult {
  key: string;
  bucket: string;
  contentType: string;
  contentLength?: number;
  body: Readable;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly config: ObjectStorageConfig | null;
  private client: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {
    try {
      this.config = parseObjectStorageConfig({
        OBJECT_STORAGE_ENDPOINT: this.configService.get('OBJECT_STORAGE_ENDPOINT'),
        OBJECT_STORAGE_BUCKET: this.configService.get('OBJECT_STORAGE_BUCKET'),
        OBJECT_STORAGE_ACCESS_KEY: this.configService.get('OBJECT_STORAGE_ACCESS_KEY'),
        OBJECT_STORAGE_SECRET_KEY: this.configService.get('OBJECT_STORAGE_SECRET_KEY'),
        OBJECT_STORAGE_REGION: this.configService.get('OBJECT_STORAGE_REGION'),
      });
      if (this.config) validateObjectStorageConfig(this.config);
    } catch (err) {
      if (err instanceof ObjectStorageConfigError) throw err;
      throw err;
    }
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  getConfigSummary(): { configured: boolean; bucket?: string; endpoint?: string; region?: string } {
    if (!this.config) return { configured: false };
    return {
      configured: true,
      bucket: this.config.bucket,
      endpoint: this.config.endpoint,
      region: this.config.region,
    };
  }

  async checkConnectivity(): Promise<{ ok: true; bucket: string }> {
    const { client, config } = this.requireClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
      return { ok: true, bucket: config.bucket };
    } catch (err) {
      this.logger.warn(`Object storage connectivity check failed: ${this.safeErrorMessage(err)}`);
      throw new ServiceUnavailableException('Object storage is unavailable.');
    }
  }

  async uploadObject(input: UploadObjectInput): Promise<StoredObject> {
    const { client, config } = this.requireClient();
    assertSafeStorageKey(input.key);

    const contentType = input.contentType?.trim() || 'application/octet-stream';
    const params: PutObjectCommandInput = {
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: contentType,
      Metadata: input.metadata,
      ACL: 'private',
    };

    try {
      await client.send(new PutObjectCommand(params));
      return {
        key: input.key,
        bucket: config.bucket,
        contentType,
        byteSize: Buffer.isBuffer(input.body)
          ? input.body.byteLength
          : input.body instanceof Uint8Array
            ? input.body.byteLength
            : undefined,
      };
    } catch (err) {
      this.logger.error(`Object upload failed for key "${input.key}": ${this.safeErrorMessage(err)}`);
      throw new StorageOperationError('Failed to upload object to private storage.');
    }
  }

  async getObjectStream(key: string): Promise<ObjectStreamResult> {
    const { client, config } = this.requireClient();
    assertSafeStorageKey(key);

    try {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );

      if (!result.Body) {
        throw new StorageOperationError('Stored object has no body.');
      }

      const body = result.Body as Readable;
      if (typeof body.pipe !== 'function') {
        throw new StorageOperationError('Stored object body is not a readable stream.');
      }

      return {
        key,
        bucket: config.bucket,
        contentType: result.ContentType ?? 'application/octet-stream',
        contentLength: result.ContentLength,
        body,
      };
    } catch (err) {
      this.logger.warn(`Object read failed for key "${key}": ${this.safeErrorMessage(err)}`);
      throw new StorageOperationError('Failed to read object from private storage.');
    }
  }

  async deleteObject(key: string): Promise<void> {
    const { client, config } = this.requireClient();
    assertSafeStorageKey(key);

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key,
        }),
      );
    } catch (err) {
      this.logger.warn(`Object delete failed for key "${key}": ${this.safeErrorMessage(err)}`);
      throw new StorageOperationError('Failed to delete object from private storage.');
    }
  }

  private requireClient(): { client: S3Client; config: ObjectStorageConfig } {
    if (!this.config) throw new StorageNotConfiguredError();
    if (!this.client) {
      this.client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
        forcePathStyle: false,
      });
    }
    return { client: this.client, config: this.config };
  }

  private safeErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message.replace(/access[_-]?key[^\s]*/gi, '[redacted]').slice(0, 300);
    }
    return 'unknown error';
  }
}

/**
 * Phase 2B submission flow should use this pattern:
 *
 * 1. Begin DB transaction.
 * 2. Insert application row (status=new).
 * 3. For each document: upload to storage FIRST or insert doc row with pending state,
 *    then upload, then finalize — never expose storage_key until upload succeeds.
 * 4. On any upload failure: rollback DB transaction AND call deleteObject() for keys
 *    already uploaded in this attempt (compensating cleanup).
 * 5. Commit only when all DB rows and all uploads succeed.
 *
 * Never commit application/document rows pointing at keys that failed to upload.
 * Never leave orphaned objects without a matching DB row after successful commit.
 */
