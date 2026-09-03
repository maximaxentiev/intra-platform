import { describe, expect, it } from 'vitest';
import {
  buildCentreShiftHistoryIdempotencyKey,
  parseCentreShiftHistoryIdempotencyKey,
  sanitizeCentreFilenameSegment,
} from './centre-shift-history.types';

describe('centre-shift-history.types', () => {
  it('round-trips idempotency keys', () => {
    const key = buildCentreShiftHistoryIdempotencyKey({
      centreId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
    });
    expect(parseCentreShiftHistoryIdempotencyKey(key)).toEqual({
      centreId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1',
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      requestId: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
    });
  });

  it('sanitizes centre filename segments', () => {
    expect(sanitizeCentreFilenameSegment('Alpha Centre')).toBe('alpha-centre');
    expect(sanitizeCentreFilenameSegment('  ')).toBe('centre');
  });
});
