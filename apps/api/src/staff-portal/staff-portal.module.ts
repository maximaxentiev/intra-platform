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
import { StaffPortalOnboardingController } from './staff-portal-onboarding.controller';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';
import { StaffPortalShiftsController } from './staff-portal-shifts.controller';
import { StaffPortalShiftsService } from './staff-portal-shifts.service';

@Module({
  imports: [AuthModule],
  controllers: [
    StaffAuthController,
    StaffPortalProfileController,
    StaffPortalAvailabilityController,
    StaffPortalOnboardingController,
    StaffPortalShiftsController,
  ],
  providers: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    CarerPortalEnabledGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
    StaffPortalOnboardingService,
    StaffPortalAvailabilityService,
    StaffPortalShiftsService,
  ],
  exports: [
    StaffAuthService,
    StaffSessionService,
    StaffSessionGuard,
    StaffPortalAuditService,
    StaffPortalInvitationsService,
    StaffPortalProfileService,
    StaffPortalOnboardingService,
    StaffPortalAvailabilityService,
    StaffPortalShiftsService,
  ],
})
export class StaffPortalModule {}
