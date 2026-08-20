import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsShiftService, ReportsStaffService],
  exports: [ReportsService, ReportsShiftService, ReportsStaffService],
})
export class ReportsModule {}
