import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/session.guard';
import { ApplicationsController } from './applications.controller';

describe('ApplicationsController auth', () => {
  it('requires authentication for list endpoint', async () => {
    const guard = new SessionGuard(
      { get: vi.fn().mockResolvedValue(null) } as never,
      new Reflector(),
      { getOrThrow: vi.fn().mockReturnValue('intra_session') } as never,
    );

    const ctx = {
      getHandler: () => ApplicationsController.prototype.list,
      getClass: () => ApplicationsController,
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }),
      }),
    };

    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
