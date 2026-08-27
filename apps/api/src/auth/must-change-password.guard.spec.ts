import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOW_PENDING_PASSWORD_CHANGE,
  MustChangePasswordGuard,
} from './must-change-password.guard';
import type { SessionPayload } from './session.service';
import type { UsersService } from '../users/users.service';

describe('MustChangePasswordGuard', () => {
  let users: UsersService;
  let guard: MustChangePasswordGuard;
  let reflector: Reflector;

  const session: SessionPayload = {
    userId: 'user-1',
    email: 'ops@example.test',
    role: 'ops',
    mustChangePassword: true,
  };

  beforeEach(() => {
    users = {
      findByIdRaw: vi.fn(),
    } as unknown as UsersService;
    reflector = new Reflector();
    guard = new MustChangePasswordGuard(reflector, users);
  });

  function context(user?: SessionPayload, allowPending = false) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      reflector: {
        getAllAndOverride: (key: string) => {
          if (key === ALLOW_PENDING_PASSWORD_CHANGE) return allowPending;
          return false;
        },
      },
    } as never;
  }

  it('blocks protected routes when the authoritative user row requires password change', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ALLOW_PENDING_PASSWORD_CHANGE) return false;
      if (key === 'isPublic') return false;
      return false;
    });
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      passwordHash: 'hash',
      fullName: 'Ops User',
      role: 'ops',
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(guard.canActivate(context(session))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows pending-password routes during forced change', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === ALLOW_PENDING_PASSWORD_CHANGE) return true;
      if (key === 'isPublic') return false;
      return false;
    });
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      passwordHash: 'hash',
      fullName: 'Ops User',
      role: 'ops',
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(guard.canActivate(context(session, true))).resolves.toBe(true);
  });

  it('allows normal routes after forced change is cleared in the database', async () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'isPublic') return false;
      return false;
    });
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      passwordHash: 'hash',
      fullName: 'Ops User',
      role: 'ops',
      isActive: true,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(guard.canActivate(context({ ...session, mustChangePassword: false }))).resolves.toBe(
      true,
    );
  });
});
