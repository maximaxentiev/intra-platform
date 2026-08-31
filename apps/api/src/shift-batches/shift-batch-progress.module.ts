import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ShiftBatchProgressCommunicationService } from './shift-batch-progress-communication.service';

@Module({
  imports: [PlatformAuditModule],
  providers: [ShiftBatchProgressCommunicationService],
  exports: [ShiftBatchProgressCommunicationService],
})
export class ShiftBatchProgressModule {}
