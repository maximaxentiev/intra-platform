import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import {
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_WINDOW_SEC,
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_MAX,
  STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_WINDOW_SEC,
  STAFF_SHARE_RATE_LIMIT_FILE_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_FILE_HOUR_WINDOW_SEC,
  STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_MAX,
  STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_WINDOW_SEC,
  STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX,
} from './staff-document-share-public.constants';

@Injectable()
export class StaffDocumentShareRateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async assertExchangeAllowed(clientIp: string): Promise<void> {
    const bucket = this.ipBucket(clientIp);
    await Promise.all([
      this.assertBucket(
        `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:exchange:minute:${bucket}`,
        STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_MAX,
        STAFF_SHARE_RATE_LIMIT_EXCHANGE_MINUTE_WINDOW_SEC,
      ),
      this.assertBucket(
        `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:exchange:hour:${bucket}`,
        STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_MAX,
        STAFF_SHARE_RATE_LIMIT_EXCHANGE_HOUR_WINDOW_SEC,
      ),
    ]);
  }

  async assertMetadataAllowed(clientIp: string): Promise<void> {
    await this.assertBucket(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:metadata:hour:${this.ipBucket(clientIp)}`,
      STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_MAX,
      STAFF_SHARE_RATE_LIMIT_METADATA_HOUR_WINDOW_SEC,
    );
  }

  async assertFileStreamAllowed(clientIp: string): Promise<void> {
    await this.assertBucket(
      `${STAFF_SHARE_RATE_LIMIT_REDIS_PREFIX}:file:hour:${this.ipBucket(clientIp)}`,
      STAFF_SHARE_RATE_LIMIT_FILE_HOUR_MAX,
      STAFF_SHARE_RATE_LIMIT_FILE_HOUR_WINDOW_SEC,
    );
  }

  private ipBucket(clientIp: string): string {
    return createHash('sha256').update(clientIp).digest('hex').slice(0, 16);
  }

  private async assertBucket(key: string, max: number, windowSec: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSec);
    }
    if (count > max) {
      throw new HttpException(
        'Too many requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
