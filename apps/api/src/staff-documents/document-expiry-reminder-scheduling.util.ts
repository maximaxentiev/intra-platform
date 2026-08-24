import {
  FIRST_AID_REMINDER_OFFSETS_MONTHS,
  VSC_REMINDER_OFFSETS_DAYS,
  type StaffDocumentType,
} from './staff-document.constants';
import {
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';
import type {
  DocumentExpiryReminderOffsetDays,
  DocumentExpiryReminderOffsetMonths,
} from './document-expiry-reminder.types';

export type FutureDocumentExpiryReminderPlan =
  | {
      unit: 'days';
      offsetDays: DocumentExpiryReminderOffsetDays;
      scheduledFor: Date;
    }
  | {
      unit: 'months';
      offsetMonths: DocumentExpiryReminderOffsetMonths;
      scheduledFor: Date;
    };

export type PlanFutureDocumentExpiryRemindersOptions = {
  /** Skip 1mo First Aid when legacy 30d day reminder was already sent. */
  legacyFirstAid30dSent?: boolean;
};

/** Future reminder offsets only — past-due intervals are omitted entirely. */
export function planFutureDocumentExpiryReminders(
  documentType: StaffDocumentType,
  expiryDate: string,
  now: Date = new Date(),
  options: PlanFutureDocumentExpiryRemindersOptions = {},
): FutureDocumentExpiryReminderPlan[] {
  if (documentType === 'vulnerable_sector_check') {
    const plans: FutureDocumentExpiryReminderPlan[] = [];
    for (const offsetDays of VSC_REMINDER_OFFSETS_DAYS) {
      const scheduledFor = torontoDocumentReminderInstant(expiryDate, offsetDays);
      if (scheduledFor.getTime() > now.getTime()) {
        plans.push({ unit: 'days', offsetDays, scheduledFor });
      }
    }
    return plans;
  }

  if (documentType === 'first_aid_cpr') {
    const plans: FutureDocumentExpiryReminderPlan[] = [];
    for (const offsetMonths of FIRST_AID_REMINDER_OFFSETS_MONTHS) {
      if (offsetMonths === 1 && options.legacyFirstAid30dSent) {
        continue;
      }
      const scheduledFor = torontoDocumentReminderInstantMonths(expiryDate, offsetMonths);
      if (scheduledFor.getTime() > now.getTime()) {
        plans.push({ unit: 'months', offsetMonths, scheduledFor });
      }
    }
    return plans;
  }

  return [];
}
