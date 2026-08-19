import { Module } from '@nestjs/common';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftCommunicationsModule } from './shift-communications.module';
import { ShiftsController } from './shifts.controller';
import { ShiftsCron } from './shifts.cron';
import { ShiftHoursAdjustmentService } from './shift-hours-adjustment.service';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [StaffDocumentsModule, ShiftCommunicationsModule],
  controllers: [ShiftsController],
  providers: [
    ShiftsService,
    ShiftsCron,
    ShiftMatchingService,
    ShiftAssignmentConfirmationService,
    ShiftAssignmentNotificationsService,
    ShiftHoursAdjustmentService,
  ],
  exports: [ShiftsService, ShiftCommunicationsModule, ShiftHoursAdjustmentService],
})
export class ShiftsModule {}
