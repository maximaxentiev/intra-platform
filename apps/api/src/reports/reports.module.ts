import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsShiftService],
  exports: [ReportsService, ReportsShiftService],
})
export class ReportsModule {}
