import { Module } from '@nestjs/common';
import { ShiftCancellationService } from './shift-cancellation.service';
import { ShiftReminderService } from './shift-reminder.service';

/**
 * Shift reminder + cancellation scheduling — no StaffDocuments/StaffPortal deps.
 * Imported by ShiftsModule, StaffPortalModule, and the worker without creating cycles.
 */
@Module({
  providers: [ShiftReminderService, ShiftCancellationService],
  exports: [ShiftReminderService, ShiftCancellationService],
})
export class ShiftCommunicationsModule {}
