import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { IS_PUBLIC } from './session.guard';
import type { SessionPayload } from './session.service';

export const ALLOW_PENDING_PASSWORD_CHANGE = 'allowPendingPasswordChange';
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

/** Blocks normal Ops routes until a forced admin password reset is completed. */
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const allowPending = this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD_CHANGE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (allowPending) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionPayload }>();
    const session = req.user;
    if (!session) return true;

    const user = await this.users.findByIdRaw(session.userId);
    if (user?.mustChangePassword) {
      throw new ForbiddenException('Password change required before accessing the platform.');
    }

    return true;
  }
}
