import {
  compareDateStrings,
  parseCalendarDateString,
} from '../availability/availability-toronto.util';

/** Add whole calendar months in Toronto calendar-date semantics (YYYY-MM-DD). */
export function addCalendarMonths(dateStr: string, months: number): string {
  const { year, month, day } = parseCalendarDateString(dateStr);
  let totalMonths = month - 1 + months;
  let y = year;
  while (totalMonths > 11) {
    totalMonths -= 12;
    y += 1;
  }
  while (totalMonths < 0) {
    totalMonths += 12;
    y -= 1;
  }
  const lastDay = new Date(Date.UTC(y, totalMonths + 1, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return `${y}-${String(totalMonths + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Earliest valid work-permit expiry: exactly six calendar months after `today` (Toronto date). */
export function minimumWorkPermitExpiryDate(today: string): string {
  return addCalendarMonths(today, 6);
}

export function isWorkPermitExpiryAtLeastSixMonths(expiry: string, today: string): boolean {
  return compareDateStrings(expiry, minimumWorkPermitExpiryDate(today)) >= 0;
}
