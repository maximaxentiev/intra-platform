import { describe, expect, it } from 'vitest';
import { torontoDocumentReminderInstant } from './document-expiry-toronto.util';

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

describe('torontoDocumentReminderInstant', () => {
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
