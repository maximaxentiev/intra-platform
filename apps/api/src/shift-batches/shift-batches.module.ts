import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ShiftBatchCompletionModule } from './shift-batch-completion.module';
import { ShiftBatchProgressModule } from './shift-batch-progress.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ShiftBatchesController } from './shift-batches.controller';
import { ShiftBatchesService } from './shift-batches.service';

@Module({
  imports: [ShiftsModule, PlatformAuditModule, ShiftBatchProgressModule, ShiftBatchCompletionModule],
  controllers: [ShiftBatchesController],
  providers: [ShiftBatchesService],
  exports: [ShiftBatchesService],
})
export class ShiftBatchesModule {}
