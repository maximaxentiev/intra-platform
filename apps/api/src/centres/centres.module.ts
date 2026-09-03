import { Module } from '@nestjs/common';
import { AutomatedCommunicationsModule } from '../automated-communications/automated-communications.module';
import { EmailModule } from '../email/email.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ReportsModule } from '../reports/reports.module';
import { CentreShiftHistoryService } from './centre-shift-history.service';
import { CentresController } from './centres.controller';
import { CentresService } from './centres.service';

@Module({
  imports: [PlatformAuditModule, ReportsModule, EmailModule, AutomatedCommunicationsModule],
  controllers: [CentresController],
  providers: [CentresService, CentreShiftHistoryService],
  exports: [CentresService, CentreShiftHistoryService],
})
export class CentresModule {}
