import Redis from 'ioredis';

export type BullMqConnectionRole = 'queue' | 'worker';

/**
 * BullMQ requires dedicated Redis connections with worker-appropriate settings.
 * Do not reuse the global API session Redis client.
 */
export function createBullMqRedisConnection(
  redisUrl: string,
  role: BullMqConnectionRole,
): Redis {
  return new Redis(redisUrl, {
    maxRetriesPerRequest: role === 'worker' ? null : 3,
    enableReadyCheck: false,
  });
}
