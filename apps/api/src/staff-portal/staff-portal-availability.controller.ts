import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/session.guard';
import {
  CreateStaffPortalAvailabilityDto,
  ListStaffPortalAvailabilityQuery,
  MarkStaffPortalUnavailableDto,
  UpdateStaffPortalAvailabilityDto,
} from './dto/staff-portal-availability.dto';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import { CurrentStaff, StaffSessionGuard } from './staff-session.guard';
import type { StaffSessionPayload } from './staff-session.service';
import { StaffPortalAvailabilityService } from './staff-portal-availability.service';

@Public()
@UseGuards(CarerPortalEnabledGuard, StaffSessionGuard)
@ApiTags('staff-portal')
@Controller('staff-portal/availability')
export class StaffPortalAvailabilityController {
  constructor(private readonly availability: StaffPortalAvailabilityService) {}

  @Get()
  list(@CurrentStaff() session: StaffSessionPayload, @Query() query: ListStaffPortalAvailabilityQuery) {
    return this.availability.list(session, query.weekStart);
  }

  @Get('onboarding-state')
  getOnboardingState(@CurrentStaff() session: StaffSessionPayload) {
    return this.availability.getOnboardingState(session);
  }

  @Post('onboarding-state/ensure')
  ensureOnboardingState(@CurrentStaff() session: StaffSessionPayload) {
    return this.availability.ensureOnboardingState(session);
  }

  @Post('mark-unavailable')
  markUnavailable(
    @CurrentStaff() session: StaffSessionPayload,
    @Body() dto: MarkStaffPortalUnavailableDto,
  ) {
    return this.availability.markUnavailable(session, dto);
  }

  @Delete('mark-unavailable')
  clearUnavailable(
    @CurrentStaff() session: StaffSessionPayload,
    @Body() dto: MarkStaffPortalUnavailableDto,
  ) {
    return this.availability.clearUnavailable(session, dto);
  }

  @Post()
  create(@CurrentStaff() session: StaffSessionPayload, @Body() dto: CreateStaffPortalAvailabilityDto) {
    return this.availability.create(session, dto);
  }

  @Post('complete-step-3')
  completeStep3(@CurrentStaff() session: StaffSessionPayload) {
    return this.availability.completeStep3(session);
  }

  @Patch(':id')
  update(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStaffPortalAvailabilityDto,
  ) {
    return this.availability.update(session, id, dto);
  }

  @Delete(':id')
  remove(@CurrentStaff() session: StaffSessionPayload, @Param('id') id: string) {
    return this.availability.remove(session, id);
  }
}
