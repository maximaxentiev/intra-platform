import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import { StaffUsageQueryDto } from './dto/staff-usage-query.dto';
import { StaffUsageShiftsQueryDto } from './dto/staff-usage-shifts-query.dto';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';

/**
 * Ops-only reporting endpoints (Phase 9C–9F).
 * Global SessionGuard applies — no @Public().
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsShift: ReportsShiftService,
    private readonly reportsStaff: ReportsStaffService,
  ) {}

  @Get('shift-fulfillment')
  shiftFulfillment(@Query() query: ShiftReportQueryDto) {
    return this.reportsShift.getShiftFulfillment(query);
  }

  @Get('centre-usage')
  centreUsage(@Query() query: CentreUsageQueryDto) {
    return this.reportsShift.getCentreUsage(query);
  }

  @Get('staff-usage')
  staffUsage(@Query() query: StaffUsageQueryDto) {
    return this.reportsStaff.getStaffUsage(query);
  }

  @Get('staff-usage/:staffId/shifts')
  staffUsageShifts(
    @Param('staffId') staffId: string,
    @Query() query: StaffUsageShiftsQueryDto,
  ) {
    return this.reportsStaff.getStaffUsageShifts(staffId, query);
  }
}
