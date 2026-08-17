import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/session.guard';
import { SessionService } from '../auth/session.service';
import { StaffSessionGuard } from './staff-session.guard';
import { hashToken } from './staff-auth.service';

const STAFF_PORTAL_PROTECTED_CONTROLLERS = [
  () => import('./staff-portal-availability.controller').then((m) => m.StaffPortalAvailabilityController),
  () => import('./staff-portal-profile.controller').then((m) => m.StaffPortalProfileController),
  () => import('./staff-portal-onboarding.controller').then((m) => m.StaffPortalOnboardingController),
  () => import('./staff-portal-shifts.controller').then((m) => m.StaffPortalShiftsController),
  () =>
    import('../staff-documents/staff-portal-documents.controller').then(
      (m) => m.StaffPortalDocumentsController,
    ),
] as const;

function configService(values: Record<string, unknown>) {
  return {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (!(key in values)) throw new Error(`missing ${key}`);
      return values[key];
    },
  } as ConfigService;
}

describe('cross-role session separation', () => {
  it('staff invite tokens are stored hashed, never as raw values in auth helpers', () => {
    const raw = 'example-invite-token-value';
    expect(hashToken(raw)).not.toBe(raw);
    expect(hashToken(raw)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ops SessionGuard ignores staff session cookie alone', async () => {
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

  it('StaffSessionGuard ignores ops session cookie alone', async () => {
    const { StaffSessionGuard: Guard } = await import('./staff-session.guard');
    const sessions = {
      cookieName: 'intra_session_staff',
      get: vi.fn().mockResolvedValue(null),
    } as never;
    const guard = new Guard(sessions);
    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ cookies: { intra_session: 'ops-only' } }),
        }),
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('staff portal protected controller guards', () => {
  it.each(STAFF_PORTAL_PROTECTED_CONTROLLERS.map((loader, index) => [index, loader] as const))(
    'controller %i is Public with carer portal and staff session guards',
    async (_index, loadController) => {
      const Controller = await loadController();
      expect(Reflect.getMetadata('isPublic', Controller)).toBe(true);
      const guards = Reflect.getMetadata('__guards__', Controller)?.map(
        (guard: { name: string }) => guard.name,
      );
      expect(guards).toEqual(['CarerPortalEnabledGuard', 'StaffSessionGuard']);
    },
  );

  it('staff-auth controller is Public with carer portal guard only at class level', async () => {
    const { StaffAuthController } = await import('./staff-auth.controller');
    expect(Reflect.getMetadata('isPublic', StaffAuthController)).toBe(true);
    const guards = Reflect.getMetadata('__guards__', StaffAuthController)?.map(
      (guard: { name: string }) => guard.name,
    );
    expect(guards).toEqual(['CarerPortalEnabledGuard']);
  });
});

describe('shift matching deferral', () => {
  it('does not import availability into shifts service', () => {
    const source = readFileSync(join(__dirname, '../shifts/shifts.service.ts'), 'utf8');
    expect(source).not.toMatch(/\bavailability\b/);
  });
});
