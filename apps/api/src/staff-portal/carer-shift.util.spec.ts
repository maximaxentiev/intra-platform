import { describe, expect, it } from 'vitest';
import {
  formatShiftTimeForCarer,
  isCarerHistoryShift,
  isCarerUpcomingShift,
  mapCarerShiftStatus,
  normalizeCarerShiftRole,
  toCarerShiftSummaryDto,
} from './carer-shift.util';

const TODAY = '2026-08-13';
const NOW = '14:30:00';

describe('normalizeCarerShiftRole', () => {
  it('returns null for empty or whitespace-only roles', () => {
    expect(normalizeCarerShiftRole('')).toBeNull();
    expect(normalizeCarerShiftRole('   ')).toBeNull();
  });

  it('returns trimmed role text', () => {
    expect(normalizeCarerShiftRole(' ECA ')).toBe('ECA');
  });
});

describe('formatShiftTimeForCarer', () => {
  it('formats HH:mm:ss to HH:mm', () => {
    expect(formatShiftTimeForCarer('08:30:00')).toBe('08:30');
  });
});

describe('mapCarerShiftStatus', () => {
  it('maps cancelled and completed directly', () => {
    expect(mapCarerShiftStatus('cancelled', '2026-08-20', '16:00:00', TODAY, NOW)).toBe(
      'cancelled',
    );
    expect(mapCarerShiftStatus('completed', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(
      'completed',
    );
  });

  it('returns null for pending', () => {
    expect(mapCarerShiftStatus('pending', TODAY, '16:00:00', TODAY, NOW)).toBeNull();
  });

  it('maps future filled to upcoming', () => {
    expect(mapCarerShiftStatus('filled', '2026-08-20', '16:00:00', TODAY, NOW)).toBe('upcoming');
  });

  it('maps today filled before end to today', () => {
    expect(mapCarerShiftStatus('filled', TODAY, '16:00:00', TODAY, NOW)).toBe('today');
  });

  it('maps today filled after end to completed before cron', () => {
    expect(mapCarerShiftStatus('filled', TODAY, '12:00:00', TODAY, NOW)).toBe('completed');
  });

  it('maps past filled to completed', () => {
    expect(mapCarerShiftStatus('filled', '2026-08-01', '16:00:00', TODAY, NOW)).toBe('completed');
  });
});

describe('isCarerUpcomingShift', () => {
  it('includes future filled, today filled before end, and future/today cancelled', () => {
    expect(isCarerUpcomingShift('filled', '2026-08-20', '16:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerUpcomingShift('filled', TODAY, '16:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerUpcomingShift('cancelled', TODAY, '16:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerUpcomingShift('cancelled', '2026-08-20', '16:00:00', TODAY, NOW)).toBe(true);
  });

  it('excludes completed, pending, past cancelled, and today filled after end', () => {
    expect(isCarerUpcomingShift('completed', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerUpcomingShift('pending', TODAY, '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerUpcomingShift('cancelled', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerUpcomingShift('filled', TODAY, '12:00:00', TODAY, NOW)).toBe(false);
  });
});

describe('isCarerHistoryShift', () => {
  it('includes completed, past filled, today filled after end, and past cancelled', () => {
    expect(isCarerHistoryShift('completed', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerHistoryShift('filled', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerHistoryShift('filled', TODAY, '12:00:00', TODAY, NOW)).toBe(true);
    expect(isCarerHistoryShift('cancelled', '2026-08-01', '16:00:00', TODAY, NOW)).toBe(true);
  });

  it('excludes upcoming filled, today cancelled, and pending', () => {
    expect(isCarerHistoryShift('filled', '2026-08-20', '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerHistoryShift('filled', TODAY, '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerHistoryShift('cancelled', TODAY, '16:00:00', TODAY, NOW)).toBe(false);
    expect(isCarerHistoryShift('pending', TODAY, '16:00:00', TODAY, NOW)).toBe(false);
  });
});

describe('toCarerShiftSummaryDto', () => {
  const baseRow = {
    id: 'shift-1',
    shiftDate: TODAY,
    startTime: '08:30:00',
    endTime: '16:30:00',
    roleNeeded: 'ECA',
    status: 'filled' as const,
    centreName: 'ABC Child Care',
    centreAddress: '123 Main St',
    centreCity: 'Toronto',
  };

  it('maps centre fields and omits internal data', () => {
    const dto = toCarerShiftSummaryDto(baseRow, TODAY, NOW);
    expect(dto).toEqual({
      id: 'shift-1',
      shiftDate: TODAY,
      startTime: '08:30',
      endTime: '16:30',
      roleNeeded: 'ECA',
      status: 'today',
      centre: {
        name: 'ABC Child Care',
        address: '123 Main St',
        city: 'Toronto',
      },
    });
    expect(dto).not.toHaveProperty('notes');
    expect(dto).not.toHaveProperty('centreId');
    expect(dto).not.toHaveProperty('assignedStaffId');
  });

  it('returns null for pending legacy rows', () => {
    expect(
      toCarerShiftSummaryDto({ ...baseRow, status: 'pending' }, TODAY, NOW),
    ).toBeNull();
  });
});

describe('overnight shift limitation', () => {
  it('treats end before start as same-day comparison (unsupported overnight model)', () => {
    // Stored as 22:00-06:00 on one date — classification uses raw time compare only.
    expect(isCarerUpcomingShift('filled', TODAY, '06:00:00', TODAY, '08:00:00')).toBe(false);
    expect(isCarerHistoryShift('filled', TODAY, '06:00:00', TODAY, '08:00:00')).toBe(true);
  });
});

describe('year boundary', () => {
  it('classifies December/January dates using string date compare', () => {
    expect(isCarerUpcomingShift('filled', '2027-01-02', '09:00:00', '2026-12-31', '10:00:00')).toBe(
      true,
    );
    expect(isCarerHistoryShift('cancelled', '2026-12-30', '09:00:00', '2026-12-31', '10:00:00')).toBe(
      true,
    );
  });
});
