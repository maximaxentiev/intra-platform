import { describe, expect, it } from 'vitest';
import { resolveCentreUsageCentreIds } from '../../reports/dto/report-centre-ids.util';

describe('resolveCentreUsageCentreIds for shift list filtering', () => {
  const idA = '11111111-1111-4111-8111-111111111111';
  const idB = '22222222-2222-4222-8222-222222222222';

  it('returns null when no centres are selected (all centres)', () => {
    expect(resolveCentreUsageCentreIds({})).toBeNull();
    expect(resolveCentreUsageCentreIds({ centreIds: [] })).toBeNull();
  });

  it('returns multiple centre IDs for OR filtering', () => {
    expect(resolveCentreUsageCentreIds({ centreIds: [idA, idB] })).toEqual([idA, idB]);
  });

  it('supports legacy single centreId param', () => {
    expect(resolveCentreUsageCentreIds({ centreId: idA })).toEqual([idA]);
  });

  it('prefers centreIds over legacy centreId', () => {
    expect(resolveCentreUsageCentreIds({ centreIds: [idA], centreId: idB })).toEqual([idA]);
  });
});
