import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/session.guard';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { CurrentStaff, StaffSessionGuard } from './staff-session.guard';
import type { StaffSessionPayload } from './staff-session.service';
import { StaffPortalOnboardingService } from './staff-portal-onboarding.service';

@Public()
@UseGuards(CarerPortalEnabledGuard, StaffSessionGuard)
@ApiTags('staff-portal')
@Controller('staff-portal/onboarding')
export class StaffPortalOnboardingController {
  constructor(private readonly onboarding: StaffPortalOnboardingService) {}

  @Post('complete')
  complete(@CurrentStaff() session: StaffSessionPayload) {
    return this.onboarding.completeOnboarding(session);
  }
}
