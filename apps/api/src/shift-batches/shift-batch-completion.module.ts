import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import { ShiftBatchProgressModule } from './shift-batch-progress.module';

@Module({
  imports: [PlatformAuditModule, StaffDocumentsModule, ShiftBatchProgressModule],
  providers: [ShiftBatchCompletionReadinessService, ShiftBatchCompletionService],
  exports: [ShiftBatchCompletionReadinessService, ShiftBatchCompletionService],
})
export class ShiftBatchCompletionModule {}
