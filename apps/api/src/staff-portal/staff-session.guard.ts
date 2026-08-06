import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffSessionService, type StaffSessionPayload } from './staff-session.service';

/**
 * Guard for staff-portal routes. Applied per-controller; those controllers are
 * marked @Public() so the global ops SessionGuard lets them through and this
 * guard performs the real staff-session check.
 */
@Injectable()
export class StaffSessionGuard implements CanActivate {
  constructor(private readonly sessions: StaffSessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { staffSession?: StaffSessionPayload; staffSessionId?: string }>();
    const sid = (req.cookies?.[this.sessions.cookieName] as string) ?? '';
    const session = await this.sessions.get(sid);
    if (!session) throw new UnauthorizedException('Not authenticated.');
    req.staffSession = session;
    req.staffSessionId = sid;
    return true;
  }
}

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffSessionPayload => {
    const req = ctx.switchToHttp().getRequest<{ staffSession?: StaffSessionPayload }>();
    return req.staffSession as StaffSessionPayload;
  },
);
