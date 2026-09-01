import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ShiftBatchStalenessService } from './shift-batch-staleness.service';

@Module({
  imports: [PlatformAuditModule],
  providers: [ShiftBatchStalenessService],
  exports: [ShiftBatchStalenessService],
})
export class ShiftBatchStalenessModule {}
