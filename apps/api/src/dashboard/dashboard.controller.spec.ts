import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/session.guard';
import { SessionService } from '../auth/session.service';
import { DashboardController } from './dashboard.controller';

function configService(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as ConfigService;
}

describe('DashboardController authorization', () => {
  it('is not marked Public (Ops session required via global SessionGuard)', () => {
    expect(Reflect.getMetadata('isPublic', DashboardController)).toBeUndefined();
  });

  it('rejects unauthenticated requests', async () => {
    const sessions = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as SessionService;
    const guard = new SessionGuard(
      sessions,
      { getAllAndOverride: vi.fn().mockReturnValue(false) } as never,
      configService({ SESSION_COOKIE_NAME: 'intra_session' }),
    );
    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => DashboardController,
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {} }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows valid ops session for DashboardController', async () => {
    const sessions = {
      get: vi.fn().mockResolvedValue({ userId: 'ops-user', role: 'admin' }),
    } as unknown as SessionService;
    const guard = new SessionGuard(
      sessions,
      { getAllAndOverride: vi.fn().mockReturnValue(false) } as never,
      configService({ SESSION_COOKIE_NAME: 'intra_session' }),
    );
    await expect(
      guard.canActivate({
        getHandler: () => ({}),
        getClass: () => DashboardController,
        switchToHttp: () => ({
          getRequest: () => ({ cookies: { intra_session: 'ops-session-token' } }),
        }),
      } as never),
    ).resolves.toBe(true);
  });
});
