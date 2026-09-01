import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftBatchChangeHistoryService } from './shift-batch-change-history.service';
import { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import { ShiftBatchCompletionService } from './shift-batch-completion.service';
import { ShiftBatchProgressModule } from './shift-batch-progress.module';
import { ShiftBatchUpdateConfirmationService } from './shift-batch-update-confirmation.service';

@Module({
  imports: [PlatformAuditModule, StaffDocumentsModule, ShiftBatchProgressModule],
  providers: [
    ShiftBatchCompletionReadinessService,
    ShiftBatchCompletionService,
    ShiftBatchChangeHistoryService,
    ShiftBatchUpdateConfirmationService,
  ],
  exports: [
    ShiftBatchCompletionReadinessService,
    ShiftBatchCompletionService,
    ShiftBatchChangeHistoryService,
    ShiftBatchUpdateConfirmationService,
  ],
})
export class ShiftBatchCompletionModule {}
