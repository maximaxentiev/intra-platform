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
import { StaffPortalAvailabilityController } from './staff-portal-availability.controller';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';

@Module({
  imports: [AuthModule],
  controllers: [
    StaffAuthController,
    StaffPortalProfileController,
    StaffPortalAvailabilityController,
  ],
  providers: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    CarerPortalEnabledGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
    StaffPortalAvailabilityService,
  ],
  exports: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
    StaffPortalAvailabilityService,
  ],
})
export class StaffPortalModule {}
