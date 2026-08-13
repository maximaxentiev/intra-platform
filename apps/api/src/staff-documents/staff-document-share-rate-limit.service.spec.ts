import { HttpException, HttpStatus } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_MAX,
  STAFF_SHARE_RATE_LIMIT_FILE_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX,
} from './staff-document-share-public.constants';
import { StaffDocumentShareRateLimitService } from './staff-document-share-rate-limit.service';

function ipBucket(clientIp: string): string {
  return createHash('sha256').update(clientIp).digest('hex').slice(0, 16);
}

describe('StaffDocumentShareRateLimitService', () => {
  it('allows exchange requests under minute and hour limits', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(60),
    };
    const service = new StaffDocumentShareRateLimitService(redis as never);

    await expect(service.assertExchangeAllowed('127.0.0.1')).resolves.toBeUndefined();

    const bucket = ipBucket('127.0.0.1');
    expect(redis.incr).toHaveBeenCalledWith(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:exchange:minute:${bucket}`,
    );
    expect(redis.incr).toHaveBeenCalledWith(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:exchange:hour:${bucket}`,
    );
  });

  it('blocks exchange when minute limit exceeded with Retry-After', async () => {
    const redis = {
      incr: vi
        .fn()
        .mockResolvedValueOnce(STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_MAX + 1)
        .mockResolvedValueOnce(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(42),
    };
    const service = new StaffDocumentShareRateLimitService(redis as never);

    await expect(service.assertExchangeAllowed('127.0.0.1')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: 'Too many requests. Please try again later.',
    });
  });

  it('blocks exchange when hour limit exceeded', async () => {
    const redis = {
      incr: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_MAX + 1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(120),
    };
    const service = new StaffDocumentShareRateLimitService(redis as never);

    await expect(service.assertExchangeAllowed('127.0.0.1')).rejects.toBeInstanceOf(HttpException);
  });

  it('uses safe redis keys without secrets for metadata and file limits', async () => {
    const redis = {
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(60),
    };
    const service = new StaffDocumentShareRateLimitService(redis as never);
    const bucket = ipBucket('203.0.113.10');

    await service.assertMetadataAllowed('203.0.113.10');
    await service.assertFileStreamAllowed('203.0.113.10');

    expect(redis.incr).toHaveBeenCalledWith(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:metadata:hour:${bucket}`,
    );
    expect(redis.incr).toHaveBeenCalledWith(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:file:hour:${bucket}`,
    );

    for (const call of redis.incr.mock.calls) {
      const key = String(call[0]);
      expect(key).not.toMatch(/token|hash|slug|filename|@/i);
    }
  });

  it('blocks metadata and file streams over their hourly limits', async () => {
    const metadataRedis = {
      incr: vi.fn().mockResolvedValue(STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_MAX + 1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(30),
    };
    const metadataService = new StaffDocumentShareRateLimitService(metadataRedis as never);
    await expect(metadataService.assertMetadataAllowed('127.0.0.1')).rejects.toBeInstanceOf(
      HttpException,
    );

    const fileRedis = {
      incr: vi.fn().mockResolvedValue(STAFF_SHARE_RATE_LIMIT_FILE_HOUR_MAX + 1),
      expire: vi.fn().mockResolvedValue(1),
      ttl: vi.fn().mockResolvedValue(30),
    };
    const fileService = new StaffDocumentShareRateLimitService(fileRedis as never);
    await expect(fileService.assertFileStreamAllowed('127.0.0.1')).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
