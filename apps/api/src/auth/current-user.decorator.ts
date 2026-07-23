import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionPayload } from './session.service';

export interface AuthedRequest extends Request {
  user?: SessionPayload;
  sessionId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: SessionPayload }>();
    return req.user as SessionPayload;
  },
);
