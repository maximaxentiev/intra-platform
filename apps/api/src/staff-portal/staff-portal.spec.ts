import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/session.guard';
import { SessionService } from '../auth/session.service';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { StaffSessionGuard } from './staff-session.guard';
import { StaffSessionService } from './staff-session.service';

function configService(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as ConfigService;
}

describe('CarerPortalEnabledGuard', () => {
  it('blocks staff-auth when CARER_PORTAL_ENABLED is false', () => {
    const guard = new CarerPortalEnabledGuard(configService({ CARER_PORTAL_ENABLED: false }));
    expect(() => guard.canActivate({} as never)).toThrow(NotFoundException);
  });

  it('allows when CARER_PORTAL_ENABLED is true', () => {
    const guard = new CarerPortalEnabledGuard(configService({ CARER_PORTAL_ENABLED: true }));
    expect(guard.canActivate({} as never)).toBe(true);
  });
});

describe('StaffSessionGuard', () => {
  it('requires staff session cookie', async () => {
    const sessions = {
      cookieName: 'intra_session_staff',
      get: vi.fn().mockResolvedValue(null),
    } as unknown as StaffSessionService;
    const guard = new StaffSessionGuard(sessions);
    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ cookies: {} }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid staff session', async () => {
    const payload = {
      kind: 'staff' as const,
      accountId: 'a',
      staffId: 's',
      email: 'c@example.test',
    };
    const sessions = {
      cookieName: 'intra_session_staff',
      get: vi.fn().mockResolvedValue(payload),
    } as unknown as StaffSessionService;
    const guard = new StaffSessionGuard(sessions);
    const req: { cookies: Record<string, string>; staffSession?: unknown } = {
      cookies: { intra_session_staff: 'sid' },
    };
    await expect(
      guard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as never),
    ).resolves.toBe(true);
    expect(req.staffSession).toEqual(payload);
  });
});

describe('ops vs staff session cookies', () => {
  it('staff session uses a suffixed cookie name', () => {
    const staffSessions = new StaffSessionService(
      { set: vi.fn(), get: vi.fn(), expire: vi.fn(), del: vi.fn() } as never,
      configService({
        SESSION_TTL_SECONDS: 3600,
        SESSION_COOKIE_NAME: 'intra_session',
        SESSION_COOKIE_SECURE: true,
      }),
    );
    expect(staffSessions.cookieName).toBe('intra_session_staff');
  });

  it('sets secure cookies when SESSION_COOKIE_SECURE is true', () => {
    const staffSessions = new StaffSessionService(
      { set: vi.fn(), get: vi.fn(), expire: vi.fn(), del: vi.fn() } as never,
      configService({
        SESSION_TTL_SECONDS: 3600,
        SESSION_COOKIE_NAME: 'intra_session',
        SESSION_COOKIE_SECURE: true,
      }),
    );
    expect(staffSessions.cookieOptions().secure).toBe(true);
    expect(staffSessions.cookieOptions().httpOnly).toBe(true);
    expect(staffSessions.cookieOptions().path).toBe('/');
  });
});

describe('SessionGuard ignores staff cookie', () => {
  it('does not authenticate ops routes with staff session alone', async () => {
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
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ cookies: { intra_session_staff: 'only-staff' } }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.get).toHaveBeenCalledWith('');
  });
});
