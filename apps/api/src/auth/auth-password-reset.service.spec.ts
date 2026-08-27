import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { hashPassword, verifyPassword } from './password.util';
import type { SessionService } from './session.service';
import type { UsersService } from '../users/users.service';

describe('AuthService admin password reset', () => {
  let users: UsersService;
  let sessions: SessionService;
  let service: AuthService;

  const activeUser = {
    id: 'user-1',
    email: 'ops@example.test',
    fullName: 'Ops User',
    passwordHash: 'hash',
    role: 'ops' as const,
    isActive: true,
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
      findByIdRaw: vi.fn(),
      getProfile: vi.fn(),
      setPermanentPassword: vi.fn(),
      applyAdminPasswordReset: vi.fn(),
    } as unknown as UsersService;
    sessions = {
      create: vi.fn().mockResolvedValue('sid-1'),
      destroy: vi.fn(),
      destroyAllForUser: vi.fn().mockResolvedValue(2),
    } as unknown as SessionService;
    service = new AuthService(users, sessions);
  });

  it('rejects login when a temporary password has expired', async () => {
    vi.mocked(users.findByEmail).mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
      passwordHash: await hashPassword('TempPass123!'),
      temporaryPasswordExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.login('ops@example.test', 'TempPass123!')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('allows login with a valid temporary password and creates a session', async () => {
    const temp = 'TempPass123!@';
    vi.mocked(users.findByEmail).mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
      passwordHash: await hashPassword(temp),
      temporaryPasswordExpiresAt: new Date(Date.now() + 60_000),
    });

    const result = await service.login('ops@example.test', temp);
    expect(result.sid).toBe('sid-1');
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ mustChangePassword: true }),
    );
  });

  it('admin reset generates a temporary password and invalidates sessions', async () => {
    vi.mocked(users.findByIdRaw).mockResolvedValue(activeUser);
    vi.mocked(users.applyAdminPasswordReset).mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
    });

    const result = await service.adminResetPassword('user-1', 'admin-1');

    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(16);
    expect(result.expiresAt).toBeTruthy();
    expect(users.applyAdminPasswordReset).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        actorUserId: 'admin-1',
        passwordHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    );
    expect(sessions.destroyAllForUser).toHaveBeenCalledWith('user-1');

    const storedHash = vi.mocked(users.applyAdminPasswordReset).mock.calls[0]![0].passwordHash;
    expect(await verifyPassword(result.temporaryPassword, storedHash)).toBe(true);
    expect(storedHash).not.toBe(result.temporaryPassword);
  });

  it('replaceForcedPassword clears forced-change state through UsersService', async () => {
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
    });

    await service.replaceForcedPassword('user-1', 'NewPassword123');

    expect(users.setPermanentPassword).toHaveBeenCalledWith('user-1', 'NewPassword123', {
      actorUserId: 'user-1',
      forced: true,
    });
  });

  it('blocks normal changePassword while forced change is required', async () => {
    vi.mocked(users.findByIdRaw).mockResolvedValue({
      ...activeUser,
      mustChangePassword: true,
      passwordHash: await hashPassword('TempPass123!'),
    });

    await expect(
      service.changePassword('user-1', 'TempPass123!', 'NewPassword123'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when admin reset target is missing', async () => {
    vi.mocked(users.findByIdRaw).mockResolvedValue(null);
    await expect(service.adminResetPassword('missing', 'admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
