import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/session.guard';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { PatchStaffPortalProfileDto } from './dto/staff-portal-profile.dto';
import { CurrentStaff, StaffSessionGuard } from './staff-session.guard';
import type { StaffSessionPayload } from './staff-session.service';
import { StaffPortalProfileService } from './staff-portal-profile.service';

@Public()
@UseGuards(CarerPortalEnabledGuard, StaffSessionGuard)
@ApiTags('staff-portal')
@Controller('staff-portal/profile')
export class StaffPortalProfileController {
  constructor(private readonly profiles: StaffPortalProfileService) {}

  @Get()
  getProfile(@CurrentStaff() session: StaffSessionPayload) {
    return this.profiles.getProfile(session);
  }

  @Patch()
  patchProfile(
    @CurrentStaff() session: StaffSessionPayload,
    @Body() dto: PatchStaffPortalProfileDto,
  ) {
    return this.profiles.updateProfile(session, dto);
  }

  @Post('complete-step-1')
  completeStep1(@CurrentStaff() session: StaffSessionPayload) {
    return this.profiles.completeProfileStep(session);
  }
}
