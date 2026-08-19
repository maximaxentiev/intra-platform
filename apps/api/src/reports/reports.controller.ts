import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import { ReportsShiftService } from './reports-shift.service';

/**
 * Ops-only reporting endpoints (Phase 9C–9F).
 * Global SessionGuard applies — no @Public().
 */
@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsShift: ReportsShiftService) {}

  @Get('shift-fulfillment')
  shiftFulfillment(@Query() query: ShiftReportQueryDto) {
    return this.reportsShift.getShiftFulfillment(query);
  }

  @Get('centre-usage')
  centreUsage(@Query() query: CentreUsageQueryDto) {
    return this.reportsShift.getCentreUsage(query);
  }
}
