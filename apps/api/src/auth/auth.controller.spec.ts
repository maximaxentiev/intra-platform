import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { UsersService } from '../users/users.service';
import type { ConfigService } from '@nestjs/config';
import { hashPassword } from './password.util';

describe('AuthController forced password change responses', () => {
  let controller: AuthController;
  let auth: AuthService;
  let sessions: SessionService;
  let users: UsersService;

  const forcedProfile = {
    id: 'user-1',
    email: 'ops@example.test',
    fullName: 'Ops User',
    role: 'ops' as const,
    isActive: true,
    mustChangePassword: true,
    temporaryPasswordExpiresAt: '2026-08-28T12:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(() => {
    users = {
      getProfile: vi.fn(),
      findByEmail: vi.fn(),
      findByIdRaw: vi.fn(),
      setPermanentPassword: vi.fn(),
    } as unknown as UsersService;
    sessions = {
      create: vi.fn().mockResolvedValue('sid-1'),
      ttlSeconds: 3600,
      update: vi.fn(),
      destroy: vi.fn(),
    } as unknown as SessionService;
    auth = new AuthService(users, sessions);
    controller = new AuthController(
      auth,
      sessions,
      users,
      {
        getOrThrow: (key: string) => {
          if (key === 'SESSION_COOKIE_NAME') return 'intra_session';
          if (key === 'SESSION_COOKIE_SECURE') return false;
          throw new Error(`missing ${key}`);
        },
      } as ConfigService,
    );
  });

  it('login response includes mustChangePassword true after admin reset login', async () => {
    const temp = 'TempPass123!@';
    vi.mocked(users.findByEmail).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      fullName: 'Ops User',
      passwordHash: await hashPassword(temp),
      role: 'ops',
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(users.getProfile).mockResolvedValue(forcedProfile);

    const res = {
      cookie: vi.fn(),
    };

    const body = await controller.login(
      { email: 'ops@example.test', password: temp },
      res as never,
    );

    expect(body.mustChangePassword).toBe(true);
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: true }),
    );
  });

  it('session response includes mustChangePassword true for forced-change users', async () => {
    vi.mocked(users.getProfile).mockResolvedValue(forcedProfile);

    const body = await controller.session({
      userId: 'user-1',
      email: 'ops@example.test',
      role: 'ops',
      mustChangePassword: true,
    });

    expect(body.mustChangePassword).toBe(true);
  });

  it('replace-password clears session forced-change flag and returns updated profile', async () => {
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      id: 'user-1',
      email: 'ops@example.test',
      fullName: 'Ops User',
      passwordHash: 'hash',
      role: 'ops',
      isActive: true,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(users.setPermanentPassword).mockResolvedValue({
      ...forcedProfile,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
    });
    vi.mocked(users.getProfile).mockResolvedValue({
      ...forcedProfile,
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
    });
    vi.mocked(sessions.update).mockResolvedValue({
      userId: 'user-1',
      email: 'ops@example.test',
      role: 'ops',
      mustChangePassword: false,
    });

    const body = await controller.replaceForcedPassword(
      { userId: 'user-1', email: 'ops@example.test', role: 'ops', mustChangePassword: true },
      { sessionId: 'sid-1' } as never,
      { newPassword: 'NewPassword123' },
    );

    expect(users.setPermanentPassword).toHaveBeenCalledWith('user-1', 'NewPassword123', {
      actorUserId: 'user-1',
      forced: true,
    });
    expect(sessions.update).toHaveBeenCalledWith('sid-1', { mustChangePassword: false });
    expect(body.mustChangePassword).toBe(false);
  });
});
