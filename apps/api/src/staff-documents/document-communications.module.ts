import { Module } from '@nestjs/common';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';

/**
 * Document expiry reminder scheduling — no StaffPortal deps.
 * Imported by StaffDocumentsModule and the worker without creating cycles.
 */
@Module({
  providers: [DocumentExpiryReminderService],
  exports: [DocumentExpiryReminderService],
})
export class DocumentCommunicationsModule {}
