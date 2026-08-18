import { torontoDocumentReminderInstant } from './document-expiry-toronto.util';
import {
  DOCUMENT_EXPIRY_REMINDER_OFFSETS,
  type DocumentExpiryReminderOffsetDays,
} from './document-expiry-reminder.types';

export type FutureDocumentExpiryReminderPlan = {
  offsetDays: DocumentExpiryReminderOffsetDays;
  scheduledFor: Date;
};

/** Future reminder offsets only — past-due intervals are omitted entirely. */
export function planFutureDocumentExpiryReminders(
  expiryDate: string,
  now: Date = new Date(),
): FutureDocumentExpiryReminderPlan[] {
  const plans: FutureDocumentExpiryReminderPlan[] = [];

  for (const offsetDays of DOCUMENT_EXPIRY_REMINDER_OFFSETS) {
    const scheduledFor = torontoDocumentReminderInstant(expiryDate, offsetDays);
    if (scheduledFor.getTime() > now.getTime()) {
      plans.push({ offsetDays, scheduledFor });
    }
  }

  return plans;
}
