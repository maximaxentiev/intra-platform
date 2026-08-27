import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'admin' | 'ops';
  mustChangePassword: boolean;
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

  /** Updates an existing session payload while preserving TTL. */
  async update(sid: string, patch: Partial<SessionPayload>): Promise<SessionPayload | null> {
    if (!sid) return null;
    const current = await this.get(sid);
    if (!current) return null;

    const next: SessionPayload = { ...current, ...patch };
    const ttl = await this.redis.ttl(PREFIX + sid);
    const expirySeconds = ttl > 0 ? ttl : this.ttl;
    await this.redis.set(PREFIX + sid, JSON.stringify(next), 'EX', expirySeconds);
    return next;
  }

  /** Invalidates every Ops session for the given platform user. */
  async destroyAllForUser(userId: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        `${PREFIX}*`,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;

        try {
          const payload = JSON.parse(raw) as SessionPayload;
          if (payload.userId === userId) {
            await this.redis.del(key);
            deleted += 1;
          }
        } catch {
          // Ignore malformed session payloads.
        }
      }
    } while (cursor !== '0');

    return deleted;
  }
}
