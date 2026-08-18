import { Module } from '@nestjs/common';
import { StaffDocumentsModule } from '../staff-documents/staff-documents.module';
import { ShiftAssignmentConfirmationService } from './shift-assignment-confirmation.service';
import { ShiftAssignmentNotificationsService } from './shift-assignment-notifications.service';
import { ShiftMatchingService } from './shift-matching.service';
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
  ],
  exports: [ShiftsService],
})
export class ShiftsModule {}
