import { Module } from '@nestjs/common';
import { ShiftBatchCompletionModule } from '../shift-batches/shift-batch-completion.module';
import { CentreEmailPreviewService } from './centre-email-preview.service';

@Module({
  imports: [ShiftBatchCompletionModule],
  providers: [CentreEmailPreviewService],
  exports: [CentreEmailPreviewService],
})
export class CentreEmailModule {}
