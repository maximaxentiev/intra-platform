import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import { DocumentComplianceQueryDto } from './dto/document-compliance-query.dto';
import { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import { StaffUsageQueryDto } from './dto/staff-usage-query.dto';
import { StaffUsageShiftsQueryDto } from './dto/staff-usage-shifts-query.dto';
import { ReportsActivityService } from './reports-activity.service';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsExportService } from './reports-export.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';

function sendCsvExport(res: Response, result: { content: string; filename: string }) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(result.content);
}

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
    private readonly reportsDocuments: ReportsDocumentsService,
    private readonly reportsActivity: ReportsActivityService,
    private readonly reportsExport: ReportsExportService,
  ) {}

  @Get('shift-fulfillment')
  shiftFulfillment(@Query() query: ShiftReportQueryDto) {
    return this.reportsShift.getShiftFulfillment(query);
  }

  @Get('shift-fulfillment/export')
  async exportShiftFulfillment(@Query() query: ShiftReportQueryDto, @Res() res: Response) {
    sendCsvExport(res, await this.reportsExport.exportShiftFulfillment(query));
  }

  @Get('centre-usage')
  centreUsage(@Query() query: CentreUsageQueryDto) {
    return this.reportsShift.getCentreUsage(query);
  }

  @Get('centre-usage/export')
  async exportCentreUsage(@Query() query: CentreUsageQueryDto, @Res() res: Response) {
    sendCsvExport(res, await this.reportsExport.exportCentreUsage(query));
  }

  @Get('staff-usage')
  staffUsage(@Query() query: StaffUsageQueryDto) {
    return this.reportsStaff.getStaffUsage(query);
  }

  @Get('staff-usage/export')
  async exportStaffUsage(@Query() query: StaffUsageQueryDto, @Res() res: Response) {
    sendCsvExport(res, await this.reportsExport.exportStaffUsage(query));
  }

  @Get('staff-usage/:staffId/shifts')
  staffUsageShifts(
    @Param('staffId') staffId: string,
    @Query() query: StaffUsageShiftsQueryDto,
  ) {
    return this.reportsStaff.getStaffUsageShifts(staffId, query);
  }

  @Get('documents')
  documentCompliance(@Query() query: DocumentComplianceQueryDto) {
    return this.reportsDocuments.getDocumentCompliance(query);
  }

  @Get('documents/export')
  async exportDocumentCompliance(@Query() query: DocumentComplianceQueryDto, @Res() res: Response) {
    sendCsvExport(res, await this.reportsExport.exportDocumentCompliance(query));
  }

  @Get('activity')
  activityLog(@Query() query: ActivityLogQueryDto) {
    return this.reportsActivity.getActivityLog(query);
  }

  @Get('activity/export')
  async exportActivityLog(@Query() query: ActivityLogQueryDto, @Res() res: Response) {
    sendCsvExport(res, await this.reportsExport.exportActivityLog(query));
  }
}
