import { describe, expect, it } from 'vitest';
import { parseReportStaffIds, resolveStaffUsageStaffIds } from './report-staff-ids.util';

describe('parseReportStaffIds', () => {
  const idA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

  it('returns undefined for empty input', () => {
    expect(parseReportStaffIds(undefined)).toBeUndefined();
    expect(parseReportStaffIds('')).toBeUndefined();
  });

  it('parses and deduplicates comma-separated values', () => {
    expect(parseReportStaffIds(`${idA},${idA},${idB}`)).toEqual([idA, idB]);
  });
});

describe('resolveStaffUsageStaffIds', () => {
  const idA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';

  it('returns null when no staff filter provided', () => {
    expect(resolveStaffUsageStaffIds({})).toBeNull();
  });

  it('prefers staffIds over legacy staffId', () => {
    expect(
      resolveStaffUsageStaffIds({
        staffIds: [idA],
        staffId: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
      }),
    ).toEqual([idA]);
  });

  it('falls back to legacy staffId', () => {
    expect(resolveStaffUsageStaffIds({ staffId: idA })).toEqual([idA]);
  });
});
