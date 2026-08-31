import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { ShiftBatchProgressModule } from '../shift-batches/shift-batch-progress.module';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftUpdateCommunicationService } from './shift-update-communication.service';
import { ShiftManualUnassignCommunicationService } from './shift-manual-unassign-communication.service';
import { ShiftCommunicationPolicyService } from './shift-communication-policy.service';
import { ShiftCommunicationsModule } from './shift-communications.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsCron } from './shifts.cron';
import { ShiftsService } from './shifts.service';
import { ShiftsFeedService } from './shifts-feed.service';

@Module({
  imports: [StaffDocumentsModule, ShiftCommunicationsModule, PlatformAuditModule, ShiftBatchProgressModule],
  controllers: [ShiftsController],
  providers: [
    ShiftsService,
    ShiftsFeedService,
    ShiftsCron,
    ShiftMatchingService,
    ShiftAssignmentConfirmationService,
    ShiftAssignmentNotificationsService,
    ShiftUpdateCommunicationService,
    ShiftManualUnassignCommunicationService,
    ShiftCommunicationPolicyService,
  ],
  exports: [ShiftsService, ShiftCommunicationsModule],
})
export class ShiftsModule {}
