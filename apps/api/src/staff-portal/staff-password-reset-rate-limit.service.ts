import { createHash } from 'node:crypto';
import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import {
  STAFF_PASSWORD_RESET_ATTEMPT_IP_MAX,
  STAFF_PASSWORD_RESET_ATTEMPT_IP_WINDOW_SEC,
  STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_MAX,
  STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_WINDOW_SEC,
  STAFF_PASSWORD_RESET_EMAIL_MAX,
  STAFF_PASSWORD_RESET_EMAIL_WINDOW_SEC,
  STAFF_PASSWORD_RESET_IP_MAX,
  STAFF_PASSWORD_RESET_IP_WINDOW_SEC,
  STAFF_PASSWORD_RESET_REDIS_PREFIX,
} from './staff-password-reset.constants';

@Injectable()
export class StaffPasswordResetRateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async assertForgotPasswordAllowed(clientIp: string, email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await Promise.all([
      this.assertBucket(
        `${STAFF_PASSWORD_RESET_REDIS_PREFIX}:forgot:ip:${this.ipBucket(clientIp)}`,
        STAFF_PASSWORD_RESET_IP_MAX,
        STAFF_PASSWORD_RESET_IP_WINDOW_SEC,
        'Too many password reset requests. Please try again later.',
      ),
      this.assertBucket(
        `${STAFF_PASSWORD_RESET_REDIS_PREFIX}:forgot:email:${this.emailBucket(normalizedEmail)}`,
        STAFF_PASSWORD_RESET_EMAIL_MAX,
        STAFF_PASSWORD_RESET_EMAIL_WINDOW_SEC,
        'Too many password reset requests for this email address. Please try again later.',
      ),
    ]);
  }

  async assertResetAttemptAllowed(clientIp: string, token: string): Promise<void> {
    await Promise.all([
      this.assertBucket(
        `${STAFF_PASSWORD_RESET_REDIS_PREFIX}:reset:ip:${this.ipBucket(clientIp)}`,
        STAFF_PASSWORD_RESET_ATTEMPT_IP_MAX,
        STAFF_PASSWORD_RESET_ATTEMPT_IP_WINDOW_SEC,
        'Too many password reset attempts. Please try again later.',
      ),
      this.assertBucket(
        `${STAFF_PASSWORD_RESET_REDIS_PREFIX}:reset:token:${this.tokenBucket(token)}`,
        STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_MAX,
        STAFF_PASSWORD_RESET_ATTEMPT_TOKEN_WINDOW_SEC,
        'Too many password reset attempts. Please try again later.',
      ),
    ]);
  }

  private ipBucket(clientIp: string): string {
    return createHash('sha256').update(clientIp).digest('hex').slice(0, 16);
  }

  private emailBucket(normalizedEmail: string): string {
    return createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 16);
  }

  private tokenBucket(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 16);
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
