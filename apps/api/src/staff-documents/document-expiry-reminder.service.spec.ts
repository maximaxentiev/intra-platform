import { describe, expect, it } from 'vitest';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import { torontoDocumentReminderInstant } from './document-expiry-toronto.util';

describe('DocumentExpiryReminderService eligibility', () => {
  const service = new DocumentExpiryReminderService({} as never, {} as never);

  it('schedules mandatory reminders regardless of legacy reminders_enabled=false', () => {
    expect(
      service.isEligibleForScheduling({
        documentType: 'first_aid_cpr',
        reviewStatus: 'approved',
        expiryDate: '2026-09-04',
        set: { currentSubmissionId: 'sub-1' },
        submission: { id: 'sub-1', supersededAt: null },
        accountStatus: 'active',
        hasPortalAccount: true,
      }),
    ).toBe(true);
  });

  it('does not schedule for immunizations even when reminders_enabled would have been true', () => {
    expect(
      service.isEligibleForScheduling({
        documentType: 'immunizations',
        reviewStatus: 'approved',
        expiryDate: '2026-09-04',
        set: { currentSubmissionId: 'sub-1' },
        submission: { id: 'sub-1', supersededAt: null },
        accountStatus: 'active',
        hasPortalAccount: true,
      }),
    ).toBe(false);
  });
});

describe('VSC annual renewal expiry reminders', () => {
  const expiryDate = '2027-09-04';
  const now = new Date('2026-08-18T13:00:00.000Z');

  it('plans all five intervals from calculated one-year expiry', () => {
    const plans = planFutureDocumentExpiryReminders(expiryDate, now);
    expect(plans.map((p) => p.offsetDays)).toEqual([30, 14, 7, 3, 1]);
  });

  it('uses 09:00 Toronto wall clock from stored expiry', () => {
    const plans = planFutureDocumentExpiryReminders(expiryDate, now);
    for (const plan of plans) {
      expect(plan.scheduledFor.toISOString()).toBe(
        torontoDocumentReminderInstant(expiryDate, plan.offsetDays).toISOString(),
      );
    }
  });
});
describe('CPR expiry 2026-09-04 from 2026-08-18', () => {
  const expiryDate = '2026-09-04';
  const now = new Date('2026-08-18T13:00:00.000Z');

  it('plans only 14d, 7d, 3d, and 1d future reminders', () => {
    const plans = planFutureDocumentExpiryReminders(expiryDate, now);
    expect(plans.map((p) => p.offsetDays)).toEqual([14, 7, 3, 1]);
  });

  it('uses 09:00 Toronto wall clock for each planned instant', () => {
    const plans = planFutureDocumentExpiryReminders(expiryDate, now);
    const expectedUtc = {
      14: new Date(torontoDocumentReminderInstant(expiryDate, 14).toISOString()),
      7: new Date(torontoDocumentReminderInstant(expiryDate, 7).toISOString()),
      3: new Date(torontoDocumentReminderInstant(expiryDate, 3).toISOString()),
      1: new Date(torontoDocumentReminderInstant(expiryDate, 1).toISOString()),
    };
    for (const plan of plans) {
      expect(plan.scheduledFor.toISOString()).toBe(expectedUtc[plan.offsetDays].toISOString());
    }
  });
});
