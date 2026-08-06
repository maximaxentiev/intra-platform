import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

/**
 * Session payload for independent carers (staff portal). Deliberately a
 * separate store + cookie from the ops team session so the two account
 * systems can never be confused for one another.
 */
export interface StaffSessionPayload {
  kind: 'staff';
  accountId: string;
  staffId: string;
  email: string;
}

const PREFIX = 'staffsess:';

@Injectable()
export class StaffSessionService {
  private readonly ttl: number;
  readonly cookieName: string;
  readonly cookieSecure: boolean;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.ttl = config.getOrThrow<number>('SESSION_TTL_SECONDS');
    this.cookieName = `${config.getOrThrow<string>('SESSION_COOKIE_NAME')}_staff`;
    this.cookieSecure = config.getOrThrow<boolean>('SESSION_COOKIE_SECURE');
  }

  get ttlSeconds(): number {
    return this.ttl;
  }

  cookieOptions(maxAge?: number) {
    return {
      httpOnly: true,
      secure: this.cookieSecure,
      sameSite: 'lax' as const,
      path: '/',
      ...(maxAge !== undefined ? { maxAge } : {}),
    };
  }

  async create(payload: StaffSessionPayload): Promise<string> {
    const sid = randomBytes(32).toString('hex');
    await this.redis.set(PREFIX + sid, JSON.stringify(payload), 'EX', this.ttl);
    return sid;
  }

  async get(sid: string): Promise<StaffSessionPayload | null> {
    if (!sid) return null;
    const raw = await this.redis.get(PREFIX + sid);
    if (!raw) return null;
    await this.redis.expire(PREFIX + sid, this.ttl);
    return JSON.parse(raw) as StaffSessionPayload;
  }

  async destroy(sid: string): Promise<void> {
    if (sid) await this.redis.del(PREFIX + sid);
  }
}
