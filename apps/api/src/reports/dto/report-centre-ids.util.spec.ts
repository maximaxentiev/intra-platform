import { describe, expect, it } from 'vitest';
import {
  parseReportCentreIds,
  resolveCentreUsageCentreIds,
} from './report-centre-ids.util';

describe('parseReportCentreIds', () => {
  const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const idB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

  it('returns undefined for empty input', () => {
    expect(parseReportCentreIds(undefined)).toBeUndefined();
    expect(parseReportCentreIds('')).toBeUndefined();
    expect(parseReportCentreIds(',')).toBeUndefined();
  });

  it('parses comma-separated values', () => {
    expect(parseReportCentreIds(`${idA},${idB}`)).toEqual([idA, idB]);
  });

  it('deduplicates repeated values', () => {
    expect(parseReportCentreIds(`${idA},${idA},${idB}`)).toEqual([idA, idB]);
    expect(parseReportCentreIds([`${idA},${idB}`, idA])).toEqual([idA, idB]);
  });
});

describe('resolveCentreUsageCentreIds', () => {
  const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const idB = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

  it('returns null when no centre filter provided', () => {
    expect(resolveCentreUsageCentreIds({})).toBeNull();
  });

  it('prefers centreIds over legacy centreId', () => {
    expect(
      resolveCentreUsageCentreIds({
        centreIds: [idA, idB],
        centreId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      }),
    ).toEqual([idA, idB]);
  });

  it('falls back to legacy centreId', () => {
    expect(resolveCentreUsageCentreIds({ centreId: idA })).toEqual([idA]);
  });
});
