import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** When CARER_PORTAL_ENABLED is false, staff-auth routes are hidden (404). */
@Injectable()
export class CarerPortalEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(_ctx: ExecutionContext): boolean {
    if (!this.config.get<boolean>('CARER_PORTAL_ENABLED')) {
      throw new NotFoundException();
    }
    return true;
  }
}
