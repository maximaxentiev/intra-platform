import { describe, expect, it } from 'vitest';
import { planFutureDocumentExpiryReminders } from './document-expiry-reminder-scheduling.util';
import { torontoDocumentReminderInstant } from './document-expiry-toronto.util';

describe('planFutureDocumentExpiryReminders', () => {
  it('returns all five intervals when expiry is 40 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 40).getTime() - 60_000);
    const plans = planFutureDocumentExpiryReminders(expiryDate, now);
    expect(plans.map((p) => p.offsetDays)).toEqual([30, 14, 7, 3, 1]);
  });

  it('returns 14d,7d,3d,1d when expiry is 20 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 20).getTime() - 60_000);
    expect(planFutureDocumentExpiryReminders(expiryDate, now).map((p) => p.offsetDays)).toEqual([
      14, 7, 3, 1,
    ]);
  });

  it('returns 7d,3d,1d when expiry is 10 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 10).getTime() - 60_000);
    expect(planFutureDocumentExpiryReminders(expiryDate, now).map((p) => p.offsetDays)).toEqual([
      7, 3, 1,
    ]);
  });

  it('returns 3d,1d when expiry is 5 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 5).getTime() - 60_000);
    expect(planFutureDocumentExpiryReminders(expiryDate, now).map((p) => p.offsetDays)).toEqual([
      3, 1,
    ]);
  });

  it('returns 1d only when expiry is 2 days away', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 2).getTime() - 60_000);
    expect(planFutureDocumentExpiryReminders(expiryDate, now).map((p) => p.offsetDays)).toEqual([1]);
  });

  it('returns none when the 1-day reminder instant has passed', () => {
    const expiryDate = '2026-10-01';
    const now = new Date(torontoDocumentReminderInstant(expiryDate, 1).getTime() + 60_000);
    expect(planFutureDocumentExpiryReminders(expiryDate, now)).toEqual([]);
  });
});
