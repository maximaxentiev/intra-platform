import { describe, expect, it } from 'vitest';
import { compareStaffMatchingSort, type StaffMatchingSortInput } from '@intra/shared';

function sortStaff(
  staff: StaffMatchingSortInput[],
  centreCity: string | null,
): StaffMatchingSortInput[] {
  return [...staff].sort((a, b) => compareStaffMatchingSort(a, b, centreCity));
}

describe('compareStaffMatchingSort — shift qualification preference', () => {
  it('ranks RECE above ordinary ECE within the same Top + city tier', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: true, legalName: 'ECE Staff', city: 'Toronto', qualificationPreferenceRank: 0 },
      { isTop: true, legalName: 'RECE Staff', city: 'Toronto', qualificationPreferenceRank: 1 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'RECE Staff',
      'ECE Staff',
    ]);
  });

  it('ranks Top ECE same city above non-Top RECE same city', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'RECE Staff', city: 'Toronto', qualificationPreferenceRank: 1 },
      { isTop: true, legalName: 'ECE Staff', city: 'Toronto', qualificationPreferenceRank: 0 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'ECE Staff',
      'RECE Staff',
    ]);
  });

  it('ranks Top ECE same city above Top RECE adjacent city', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: true, legalName: 'RECE Adjacent', city: 'Mississauga', qualificationPreferenceRank: 1 },
      { isTop: true, legalName: 'ECE Same City', city: 'Toronto', qualificationPreferenceRank: 0 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'ECE Same City',
      'RECE Adjacent',
    ]);
  });

  it('ranks qualified ECA above unqualified ECA within the same tier', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Unqualified', city: 'Toronto', qualificationPreferenceRank: 0 },
      { isTop: false, legalName: 'Qualified', city: 'Toronto', qualificationPreferenceRank: 1 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'Qualified',
      'Unqualified',
    ]);
  });

  it('ranks Top unqualified ECA same city above non-Top qualified ECA same city', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Qualified', city: 'Toronto', qualificationPreferenceRank: 1 },
      { isTop: true, legalName: 'Top Unqualified', city: 'Toronto', qualificationPreferenceRank: 0 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'Top Unqualified',
      'Qualified',
    ]);
  });

  it('ranks Top unqualified ECA same city above Top qualified ECA adjacent city', () => {
    const staff: StaffMatchingSortInput[] = [
      {
        isTop: true,
        legalName: 'Qualified Adjacent',
        city: 'Mississauga',
        qualificationPreferenceRank: 1,
      },
      {
        isTop: true,
        legalName: 'Top Unqualified Same City',
        city: 'Toronto',
        qualificationPreferenceRank: 0,
      },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'Top Unqualified Same City',
      'Qualified Adjacent',
    ]);
  });

  it('matches the full ECE same-tier ordering example', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'ECE non-Top', city: 'Toronto', qualificationPreferenceRank: 0 },
      { isTop: true, legalName: 'RECE Top', city: 'Toronto', qualificationPreferenceRank: 1 },
      { isTop: false, legalName: 'RECE non-Top', city: 'Toronto', qualificationPreferenceRank: 1 },
      { isTop: true, legalName: 'ECE Top', city: 'Toronto', qualificationPreferenceRank: 0 },
    ];

    expect(sortStaff(staff, 'Toronto').map((row) => row.legalName)).toEqual([
      'RECE Top',
      'ECE Top',
      'RECE non-Top',
      'ECE non-Top',
    ]);
  });
});
