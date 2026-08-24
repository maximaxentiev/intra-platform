import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffSessionService, type StaffSessionPayload } from './staff-session.service';

function mockRedis() {
  const store = new Map<string, string>();

  return {
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    expire: vi.fn(async () => 1),
    scan: vi.fn(async (cursor: string, _match: string, _pattern: string, _count: string, _n: number) => {
      const keys = [...store.keys()];
      if (cursor === '0') {
        return ['0', keys];
      }
      return ['0', []];
    }),
    store,
  };
}

function configService() {
  return {
    getOrThrow: (key: string) => {
      if (key === 'SESSION_TTL_SECONDS') return 3600;
      if (key === 'SESSION_COOKIE_NAME') return 'intra_session';
      if (key === 'SESSION_COOKIE_SECURE') return true;
      throw new Error(`missing ${key}`);
    },
  } as never;
}

describe('StaffSessionService.destroyAllForAccount', () => {
  let redis: ReturnType<typeof mockRedis>;
  let service: StaffSessionService;

  beforeEach(() => {
    redis = mockRedis();
    service = new StaffSessionService(redis as never, configService());
  });

  it('deletes only sessions for the target account', async () => {
    const payloadA: StaffSessionPayload = {
      kind: 'staff',
      accountId: 'acc-a',
      staffId: 'staff-a',
      email: 'a@example.test',
    };
    const payloadB: StaffSessionPayload = {
      kind: 'staff',
      accountId: 'acc-b',
      staffId: 'staff-b',
      email: 'b@example.test',
    };

    redis.store.set('staffsess:sid-a1', JSON.stringify(payloadA));
    redis.store.set('staffsess:sid-a2', JSON.stringify(payloadA));
    redis.store.set('staffsess:sid-b1', JSON.stringify(payloadB));

    const deleted = await service.destroyAllForAccount('acc-a');

    expect(deleted).toBe(2);
    expect(redis.store.has('staffsess:sid-a1')).toBe(false);
    expect(redis.store.has('staffsess:sid-a2')).toBe(false);
    expect(redis.store.has('staffsess:sid-b1')).toBe(true);
  });
});
