import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'admin' | 'ops';
}

const PREFIX = 'sess:';

@Injectable()
export class SessionService {
  private readonly ttl: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    config: ConfigService,
  ) {
    this.ttl = config.getOrThrow<number>('SESSION_TTL_SECONDS');
  }

  get ttlSeconds(): number {
    return this.ttl;
  }

  async create(payload: SessionPayload): Promise<string> {
    const sid = randomBytes(32).toString('hex');
    await this.redis.set(PREFIX + sid, JSON.stringify(payload), 'EX', this.ttl);
    return sid;
  }

  async get(sid: string): Promise<SessionPayload | null> {
    if (!sid) return null;
    const raw = await this.redis.get(PREFIX + sid);
    if (!raw) return null;
    // Sliding expiration — refresh TTL on each authenticated request.
    await this.redis.expire(PREFIX + sid, this.ttl);
    return JSON.parse(raw) as SessionPayload;
  }

  async destroy(sid: string): Promise<void> {
    if (sid) await this.redis.del(PREFIX + sid);
  }
}
