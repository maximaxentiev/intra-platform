import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { SessionGuard } from '../auth/session.guard';
import { ApplicationsController } from './applications.controller';

describe('ApplicationsController auth', () => {
  const guard = new SessionGuard(
    { get: vi.fn().mockResolvedValue(null) } as never,
    new Reflector(),
    { getOrThrow: vi.fn().mockReturnValue('intra_session') } as never,
  );

  function authContext(handler: () => unknown) {
    return {
      getHandler: () => handler,
      getClass: () => ApplicationsController,
      switchToHttp: () => ({
        getRequest: () => ({ cookies: {} }),
      }),
    };
  }

  it('requires authentication for list endpoint', async () => {
    await expect(guard.canActivate(authContext(ApplicationsController.prototype.list) as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('requires authentication for document content endpoint', async () => {
    await expect(
      guard.canActivate(authContext(ApplicationsController.prototype.documentContent) as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
