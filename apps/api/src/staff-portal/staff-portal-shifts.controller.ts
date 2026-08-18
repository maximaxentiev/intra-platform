import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/session.guard';
import { CarerPortalEnabledGuard } from './carer-portal-enabled.guard';
import {
  CancelStaffPortalShiftDto,
  ListStaffPortalShiftHistoryQuery,
  ListStaffPortalShiftsQuery,
  StaffPortalShiftsSummaryQuery,
} from './dto/staff-portal-shifts.dto';
import { CurrentStaff, StaffSessionGuard } from './staff-session.guard';
import type { StaffSessionPayload } from './staff-session.service';
import { StaffPortalShiftsService } from './staff-portal-shifts.service';

@Public()
@UseGuards(CarerPortalEnabledGuard, StaffSessionGuard)
@ApiTags('staff-portal')
@Controller('staff-portal/shifts')
export class StaffPortalShiftsController {
  constructor(private readonly shifts: StaffPortalShiftsService) {}

  @Get('upcoming')
  listUpcoming(
    @CurrentStaff() session: StaffSessionPayload,
    @Query() query: ListStaffPortalShiftsQuery,
  ) {
    return this.shifts.listUpcoming(session, query.page, query.pageSize);
  }

  @Get('history')
  listHistory(
    @CurrentStaff() session: StaffSessionPayload,
    @Query() query: ListStaffPortalShiftHistoryQuery,
  ) {
    return this.shifts.listHistory(session, query.page, query.pageSize);
  }

  @Get('summary')
  summary(
    @CurrentStaff() session: StaffSessionPayload,
    @Query() query: StaffPortalShiftsSummaryQuery,
  ) {
    return this.shifts.summary(session, query.limit);
  }

  @Post(':id/cancel')
  cancelShift(
    @CurrentStaff() session: StaffSessionPayload,
    @Param('id') id: string,
    @Body() dto: CancelStaffPortalShiftDto,
  ) {
    return this.shifts.cancelShift(session, id, dto.reason);
  }

  @Get(':id')
  getDetail(@CurrentStaff() session: StaffSessionPayload, @Param('id') id: string) {
    return this.shifts.getDetail(session, id);
  }
}
