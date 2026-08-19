import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  torontoDateEndExclusiveInstant,
  torontoDateStartInstant,
} from './report-timezone.util';

describe('report timezone instants', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps Toronto calendar date start to the correct UTC instant in EST', () => {
    expect(torontoDateStartInstant('2026-01-15').toISOString()).toBe('2026-01-15T05:00:00.000Z');
  });

  it('maps Toronto calendar date start to the correct UTC instant in EDT', () => {
    expect(torontoDateStartInstant('2026-08-19').toISOString()).toBe('2026-08-19T04:00:00.000Z');
  });

  it('uses exclusive next-day Toronto boundary', () => {
    const start = torontoDateStartInstant('2026-08-19');
    const end = torontoDateEndExclusiveInstant('2026-08-19');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('handles spring DST transition day', () => {
    expect(torontoDateStartInstant('2026-03-08').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(torontoDateStartInstant('2026-03-09').toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});
