import { describe, expect, it } from 'vitest';
import { DocumentExpiryReminderService } from './document-expiry-reminder.service';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import {
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';

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

  it('does not schedule for COVID vaccination', () => {
    expect(
      service.isEligibleForScheduling({
        documentType: 'covid19_vaccination',
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

  it('plans all five day intervals from calculated one-year expiry', () => {
    const plans = planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'days' ? p.offsetDays : null))).toEqual([30, 14, 7, 3, 1]);
  });

  it('uses 09:00 Toronto wall clock from stored expiry', () => {
    const plans = planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now);
    for (const plan of plans) {
      expect(plan.unit).toBe('days');
      if (plan.unit === 'days') {
        expect(plan.scheduledFor.toISOString()).toBe(
          torontoDocumentReminderInstant(expiryDate, plan.offsetDays).toISOString(),
        );
      }
    }
  });

  it('does not plan month-based reminders for VSC', () => {
    const plans = planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now);
    expect(plans.some((plan) => plan.unit === 'months')).toBe(false);
  });
});

describe('First Aid monthly expiry reminders', () => {
  it('returns no reminders when all monthly milestones have passed', () => {
    const expiryDate = '2026-09-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans).toEqual([]);
  });

  it('returns only future 1mo when expiry is about six weeks away', () => {
    const expiryDate = '2026-10-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'months' ? p.offsetMonths : null))).toEqual([1]);
  });

  it('does not plan legacy day-based reminders', () => {
    const expiryDate = '2026-10-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans.some((plan) => plan.unit === 'days')).toBe(false);
  });

  it('uses 09:00 Toronto wall clock for each planned month instant', () => {
    const expiryDate = '2026-10-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    for (const plan of plans) {
      expect(plan.unit).toBe('months');
      if (plan.unit === 'months') {
        expect(plan.scheduledFor.toISOString()).toBe(
          torontoDocumentReminderInstantMonths(expiryDate, plan.offsetMonths).toISOString(),
        );
      }
    }
  });
});

describe('First Aid expiry 2027-11-30 from 2026-01-01', () => {
  const expiryDate = '2027-11-30';
  const now = new Date('2026-01-01T14:00:00.000Z');

  it('plans 3mo, 2mo, and 1mo future reminders', () => {
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'months' ? p.offsetMonths : null))).toEqual([3, 2, 1]);
  });
});
