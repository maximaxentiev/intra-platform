import { describe, expect, it } from 'vitest';
import {
  subtractCalendarMonthsFromDateOnly,
  torontoDocumentReminderInstant,
  torontoDocumentReminderInstantMonths,
} from './document-expiry-toronto.util';

function torontoParts(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

describe('torontoDocumentReminderInstant (VSC day offsets)', () => {
  it('schedules 30d before expiry at 09:00 Toronto on the reminder calendar date', () => {
    const instant = torontoDocumentReminderInstant('2026-06-15', 30);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2026', month: '05', day: '16', hour: '09', minute: '00' });
  });

  it('handles spring DST transition (EDT) at 09:00 Toronto wall clock', () => {
    const instant = torontoDocumentReminderInstant('2026-03-15', 7);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2026', month: '03', day: '08', hour: '09', minute: '00' });
  });

  it('handles fall DST transition (EST) at 09:00 Toronto wall clock', () => {
    const instant = torontoDocumentReminderInstant('2026-11-10', 7);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2026', month: '11', day: '03', hour: '09', minute: '00' });
  });

  it('uses calendar-day subtraction across month boundaries', () => {
    const instant = torontoDocumentReminderInstant('2026-03-05', 14);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2026', month: '02', day: '19', hour: '09', minute: '00' });
  });
});

describe('subtractCalendarMonthsFromDateOnly', () => {
  it('subtracts 3, 2, and 1 calendar months from a normal expiry date', () => {
    expect(subtractCalendarMonthsFromDateOnly('2027-11-30', 3)).toEqual({
      year: 2027,
      month: 8,
      day: 30,
    });
    expect(subtractCalendarMonthsFromDateOnly('2027-11-30', 2)).toEqual({
      year: 2027,
      month: 9,
      day: 30,
    });
    expect(subtractCalendarMonthsFromDateOnly('2027-11-30', 1)).toEqual({
      year: 2027,
      month: 10,
      day: 30,
    });
  });

  it('handles month-end expiry dates across shorter months', () => {
    expect(subtractCalendarMonthsFromDateOnly('2028-05-31', 3)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
    expect(subtractCalendarMonthsFromDateOnly('2028-05-31', 2)).toEqual({
      year: 2028,
      month: 3,
      day: 31,
    });
    expect(subtractCalendarMonthsFromDateOnly('2028-05-31', 1)).toEqual({
      year: 2028,
      month: 4,
      day: 30,
    });
  });

  it('handles Mar 31 to Feb 28/29 for 1 month back', () => {
    expect(subtractCalendarMonthsFromDateOnly('2027-03-31', 1)).toEqual({
      year: 2027,
      month: 2,
      day: 28,
    });
    expect(subtractCalendarMonthsFromDateOnly('2028-03-31', 1)).toEqual({
      year: 2028,
      month: 2,
      day: 29,
    });
  });

  it('crosses year boundaries', () => {
    expect(subtractCalendarMonthsFromDateOnly('2027-01-15', 1)).toEqual({
      year: 2026,
      month: 12,
      day: 15,
    });
  });
});

describe('torontoDocumentReminderInstantMonths (First Aid month offsets)', () => {
  it('schedules 3mo before expiry at 09:00 Toronto on the reminder calendar date', () => {
    const instant = torontoDocumentReminderInstantMonths('2027-11-30', 3);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2027', month: '08', day: '30', hour: '09', minute: '00' });
  });

  it('handles month-end expiry at 09:00 Toronto', () => {
    const instant = torontoDocumentReminderInstantMonths('2028-05-31', 3);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2028', month: '02', day: '29', hour: '09', minute: '00' });
  });

  it('keeps 09:00 Toronto wall clock during summer (EDT)', () => {
    const instant = torontoDocumentReminderInstantMonths('2027-08-15', 1);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2027', month: '07', day: '15', hour: '09', minute: '00' });
  });

  it('keeps 09:00 Toronto wall clock during winter (EST)', () => {
    const instant = torontoDocumentReminderInstantMonths('2027-02-15', 1);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2027', month: '01', day: '15', hour: '09', minute: '00' });
  });

  it('handles DST-adjacent month reminder dates at 09:00 Toronto', () => {
    const instant = torontoDocumentReminderInstantMonths('2027-03-15', 1);
    const parts = torontoParts(instant);
    expect(parts).toMatchObject({ year: '2027', month: '02', day: '15', hour: '09', minute: '00' });
  });
});
