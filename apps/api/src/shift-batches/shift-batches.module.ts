import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ReportsModule } from '../reports/reports.module';
import { ShiftBatchCompletionModule } from './shift-batch-completion.module';
import { ShiftBatchProgressModule } from './shift-batch-progress.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftBatchActivityService } from './shift-batch-activity.service';
import { ShiftBatchesController } from './shift-batches.controller';
import { ShiftBatchesService } from './shift-batches.service';

@Module({
  imports: [ShiftsModule, PlatformAuditModule, ReportsModule, ShiftBatchProgressModule, ShiftBatchCompletionModule],
  controllers: [ShiftBatchesController],
  providers: [ShiftBatchesService, ShiftBatchActivityService],
  exports: [ShiftBatchesService],
})
export class ShiftBatchesModule {}
