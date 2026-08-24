import { HttpException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffPasswordResetRateLimitService } from './staff-password-reset-rate-limit.service';
import {
  STAFF_PASSWORD_RESET_EMAIL_MAX,
  STAFF_PASSWORD_RESET_IP_MAX,
} from './staff-password-reset.constants';

function mockRedis() {
  const store = new Map<string, number>();
  return {
    incr: vi.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: vi.fn(async () => 1),
    store,
  } as never;
}

describe('StaffPasswordResetRateLimitService', () => {
  let redis: ReturnType<typeof mockRedis>;
  let service: StaffPasswordResetRateLimitService;

  beforeEach(() => {
    redis = mockRedis();
    service = new StaffPasswordResetRateLimitService(redis);
  });

  it('allows requests under forgot-password limits', async () => {
    await expect(
      service.assertForgotPasswordAllowed('1.2.3.4', 'carer@example.test'),
    ).resolves.toBeUndefined();
  });

  it('blocks forgot-password requests when email limit exceeded', async () => {
    for (let i = 0; i < STAFF_PASSWORD_RESET_EMAIL_MAX; i += 1) {
      await service.assertForgotPasswordAllowed('1.2.3.4', 'carer@example.test');
    }
    await expect(
      service.assertForgotPasswordAllowed('1.2.3.4', 'carer@example.test'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('blocks forgot-password requests when IP limit exceeded', async () => {
    for (let i = 0; i < STAFF_PASSWORD_RESET_IP_MAX; i += 1) {
      await service.assertForgotPasswordAllowed('9.9.9.9', `user${i}@example.test`);
    }
    await expect(
      service.assertForgotPasswordAllowed('9.9.9.9', 'another@example.test'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('hashes email into redis keys', async () => {
    await service.assertForgotPasswordAllowed('1.2.3.4', 'Carer@Example.test');
    const keys = [...(redis as { store: Map<string, number> }).store.keys()];
    expect(keys.some((key) => key.includes('forgot:email:'))).toBe(true);
    expect(keys.some((key) => key.includes('carer@example.test'))).toBe(false);
  });
});
