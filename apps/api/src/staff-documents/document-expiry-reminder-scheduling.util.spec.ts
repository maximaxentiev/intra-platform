import { describe, expect, it } from 'vitest';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import {
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';

describe('planFutureDocumentExpiryReminders — VSC day schedule', () => {
  it('returns all five intervals when expiry is 40 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 40).getTime() - 60_000);
    const plans = planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'days' ? p.offsetDays : null))).toEqual([30, 14, 7, 3, 1]);
  });

  it('returns 14d,7d,3d,1d when expiry is 20 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 20).getTime() - 60_000);
    expect(
      planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now).map((p) =>
        p.unit === 'days' ? p.offsetDays : null,
      ),
    ).toEqual([14, 7, 3, 1]);
  });

  it('returns 7d,3d,1d when expiry is 10 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 10).getTime() - 60_000);
    expect(
      planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now).map((p) =>
        p.unit === 'days' ? p.offsetDays : null,
      ),
    ).toEqual([7, 3, 1]);
  });

  it('returns 3d,1d when expiry is 5 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 5).getTime() - 60_000);
    expect(
      planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now).map((p) =>
        p.unit === 'days' ? p.offsetDays : null,
      ),
    ).toEqual([3, 1]);
  });

  it('returns 1d only when expiry is 2 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 2).getTime() - 60_000);
    expect(
      planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now).map((p) =>
        p.unit === 'days' ? p.offsetDays : null,
      ),
    ).toEqual([1]);
  });

  it('returns none when the 1-day reminder instant has passed', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 1).getTime() + 60_000);
    expect(planFutureDocumentExpiryReminders('vulnerable_sector_check', expiryDate, now)).toEqual([]);
  });
});

describe('planFutureDocumentExpiryReminders — First Aid month schedule', () => {
  it('returns 3mo, 2mo, and 1mo when expiry is far in the future', () => {
    const expiryDate = '2027-11-30';
    const now = new Date('2026-01-01T14:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'months' ? p.offsetMonths : null))).toEqual([3, 2, 1]);
  });

  it('uses calendar-month subtraction, not fixed day counts', () => {
    const expiryDate = '2027-11-30';
    const now = new Date('2026-01-01T14:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans[0]?.scheduledFor.toISOString()).toBe(
      torontoDocumentReminderInstantMonths(expiryDate, 3).toISOString(),
    );
    expect(plans[1]?.scheduledFor.toISOString()).toBe(
      torontoDocumentReminderInstantMonths(expiryDate, 2).toISOString(),
    );
    expect(plans[2]?.scheduledFor.toISOString()).toBe(
      torontoDocumentReminderInstantMonths(expiryDate, 1).toISOString(),
    );
  });

  it('omits past monthly milestones without mass-backfilling', () => {
    const expiryDate = '2026-09-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans).toEqual([]);
  });

  it('returns only future 1mo when earlier milestones have passed', () => {
    const expiryDate = '2026-10-04';
    const now = new Date('2026-08-18T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now);
    expect(plans.map((p) => (p.unit === 'months' ? p.offsetMonths : null))).toEqual([1]);
  });

  it('returns none when the 1-month reminder instant has passed', () => {
    const expiryDate = '2026-09-04';
    const now = new Date(torontoDocumentReminderInstantMonths(expiryDate, 1).getTime() + 60_000);
    expect(planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now)).toEqual([]);
  });

  it('skips 1mo when legacy 30d reminder was already sent', () => {
    const expiryDate = '2026-11-04';
    const now = new Date('2026-10-01T13:00:00.000Z');
    const plans = planFutureDocumentExpiryReminders('first_aid_cpr', expiryDate, now, {
      legacyFirstAid30dSent: true,
    });
    expect(plans).toEqual([]);
  });

  it('returns no reminders for immunizations or COVID', () => {
    expect(planFutureDocumentExpiryReminders('immunizations', '2027-01-01')).toEqual([]);
    expect(planFutureDocumentExpiryReminders('covid19_vaccination', '2027-01-01')).toEqual([]);
  });
});
