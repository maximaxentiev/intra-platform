import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import {
  NETWORK_SUBMIT_RATE_LIMIT_EMAIL_MAX,
  NETWORK_SUBMIT_RATE_LIMIT_EMAIL_WINDOW_SEC,
  NETWORK_SUBMIT_RATE_LIMIT_IP_MAX,
  NETWORK_SUBMIT_RATE_LIMIT_IP_WINDOW_SEC,
} from './network-submit.constants';

@Injectable()
export class NetworkSubmitRateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async assertAllowed(ip: string, email: string): Promise<void> {
    await Promise.all([
      this.assertBucket(
        `network-submit:ip:${ip}`,
        NETWORK_SUBMIT_RATE_LIMIT_IP_MAX,
        NETWORK_SUBMIT_RATE_LIMIT_IP_WINDOW_SEC,
        'Too many submissions from this network. Please try again later.',
      ),
      this.assertBucket(
        `network-submit:email:${email.toLowerCase()}`,
        NETWORK_SUBMIT_RATE_LIMIT_EMAIL_MAX,
        NETWORK_SUBMIT_RATE_LIMIT_EMAIL_WINDOW_SEC,
        'Too many submissions for this email address. Please try again later.',
      ),
    ]);
  }

  private async assertBucket(
    key: string,
    max: number,
    windowSec: number,
    message: string,
  ): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSec);
    }
    if (count > max) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
