import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftUpdateCommunicationService } from './shift-update-communication.service';
import { ShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication.service';
import { ShiftCommunicationsModule } from './shift-communications.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsCron } from './shifts.cron';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [StaffDocumentsModule, ShiftCommunicationsModule, PlatformAuditModule],
  controllers: [ShiftsController],
  providers: [
    ShiftsService,
    ShiftsCron,
    ShiftMatchingService,
    ShiftAssignmentConfirmationService,
    ShiftAssignmentNotificationsService,
    ShiftUpdateCommunicationService,
    ShiftManualUnassignCommunicationService,
  ],
  exports: [ShiftsService, ShiftCommunicationsModule],
})
export class ShiftsModule {}
