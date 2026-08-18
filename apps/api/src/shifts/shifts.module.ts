import { Module } from '@nestjs/common';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
import { ShiftReminderService } from './shift-reminder.service';
import { ShiftCancellationService } from './shift-cancellation.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsCron } from './shifts.cron';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [StaffDocumentsModule],
  controllers: [ShiftsController],
  providers: [
    ShiftsService,
    ShiftsCron,
    ShiftMatchingService,
    ShiftAssignmentConfirmationService,
    ShiftAssignmentNotificationsService,
    ShiftReminderService,
    ShiftCancellationService,
  ],
  exports: [ShiftsService, ShiftReminderService, ShiftCancellationService],
})
export class ShiftsModule {}
