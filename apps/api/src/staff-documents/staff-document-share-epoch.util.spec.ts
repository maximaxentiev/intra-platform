import { describe, expect, it } from 'vitest';
import { shareTokenRotationEpoch, shareTokenRotationEpochFromPersisted } from './staff-document-share-epoch.util';

describe('shareTokenRotationEpoch', () => {
  it('uses UTC epoch milliseconds from Date', () => {
    const createdAt = new Date('2026-08-01T12:34:56.789Z');
    expect(shareTokenRotationEpoch(createdAt)).toBe(createdAt.getTime());
  });

  it('rejects invalid dates', () => {
    expect(() => shareTokenRotationEpoch(new Date('invalid'))).toThrow(/Invalid share token rotation timestamp/);
  });
});

describe('shareTokenRotationEpochFromPersisted', () => {
  it('returns null for missing values', () => {
    expect(shareTokenRotationEpochFromPersisted(null)).toBeNull();
    expect(shareTokenRotationEpochFromPersisted(undefined)).toBeNull();
  });

  it('parses ISO strings consistently with Date objects', () => {
    const iso = '2026-08-01T12:34:56.789Z';
    const fromString = shareTokenRotationEpochFromPersisted(iso);
    const fromDate = shareTokenRotationEpochFromPersisted(new Date(iso));
    expect(fromString).toBe(fromDate);
  });

  it('returns null for invalid persisted values', () => {
    expect(shareTokenRotationEpochFromPersisted('not-a-date')).toBeNull();
  });
});
