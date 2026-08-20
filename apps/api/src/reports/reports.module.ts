import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsShiftService, ReportsStaffService, ReportsDocumentsService],
  exports: [ReportsService, ReportsShiftService, ReportsStaffService, ReportsDocumentsService],
})
export class ReportsModule {}
