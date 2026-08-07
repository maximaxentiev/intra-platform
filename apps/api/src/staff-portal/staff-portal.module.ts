import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { StaffSessionGuard } from './staff-session.guard';
import { StaffSessionService } from './staff-session.service';
import { StaffPortalAuditService } from './staff-portal-audit.service';
import { StaffPortalInvitationsService } from './staff-portal-invitations.service';
import { StaffPortalProfileController } from './staff-portal-profile.controller';
import { StaffPortalProfileService } from './staff-portal-profile.service';

@Module({
  imports: [AuthModule],
  controllers: [StaffAuthController, StaffPortalProfileController],
  providers: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    CarerPortalEnabledGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
  ],
  exports: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
  ],
})
export class StaffPortalModule {}
