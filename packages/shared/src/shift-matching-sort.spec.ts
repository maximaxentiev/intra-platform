import { describe, expect, it } from 'vitest';
import {
  compareStaffMatchingSort,
  type StaffMatchingSortInput,
} from './shift-matching-sort';

function sortStaff(
  staff: StaffMatchingSortInput[],
  centreCity: string | null,
): StaffMatchingSortInput[] {
  return [...staff].sort((a, b) => compareStaffMatchingSort(a, b, centreCity));
}

describe('compareStaffMatchingSort', () => {
  it('ranks Top Staff before non-Top regardless of city', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Chris', city: 'Toronto' },
      { isTop: true, legalName: 'Zara', city: 'London' },
      { isTop: false, legalName: 'Frank', city: 'Windsor' },
      { isTop: true, legalName: 'Amy', city: 'Toronto' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => s.legalName)).toEqual([
      'Amy',
      'Zara',
      'Chris',
      'Frank',
    ]);
  });

  it('applies geographic tiers within Top Staff for a Toronto centre', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: true, legalName: 'Zara', city: 'London' },
      { isTop: true, legalName: 'Amy', city: 'Toronto' },
      { isTop: true, legalName: 'Ben', city: 'Mississauga' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => s.legalName)).toEqual([
      'Amy',
      'Ben',
      'Zara',
    ]);
  });

  it('applies geographic tiers within non-Top Staff for a Toronto centre', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Frank', city: 'Windsor' },
      { isTop: false, legalName: 'Erin', city: 'Oshawa' },
      { isTop: false, legalName: 'Dana', city: 'Mississauga' },
      { isTop: false, legalName: 'Chris', city: 'Toronto' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => s.legalName)).toEqual([
      'Chris',
      'Dana',
      'Erin',
      'Frank',
    ]);
  });

  it('matches the full Toronto centre example from product spec', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: true, legalName: 'Zara', city: 'London' },
      { isTop: true, legalName: 'Amy', city: 'Toronto' },
      { isTop: true, legalName: 'Ben', city: 'Mississauga' },
      { isTop: false, legalName: 'Chris', city: 'Toronto' },
      { isTop: false, legalName: 'Dana', city: 'Mississauga' },
      { isTop: false, legalName: 'Erin', city: 'Oshawa' },
      { isTop: false, legalName: 'Frank', city: 'Windsor' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => `${s.legalName} - ${s.city}`)).toEqual([
      'Amy - Toronto',
      'Ben - Mississauga',
      'Zara - London',
      'Chris - Toronto',
      'Dana - Mississauga',
      'Erin - Oshawa',
      'Frank - Windsor',
    ]);
  });

  it('uses legal name as the final tie-break within the same tier', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Taylor', city: 'Toronto' },
      { isTop: false, legalName: 'Alex', city: 'Toronto' },
      { isTop: false, legalName: 'Morgan', city: 'Toronto' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => s.legalName)).toEqual([
      'Alex',
      'Morgan',
      'Taylor',
    ]);
  });

  it('sorts unknown staff city in the final geographic tier', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Near', city: 'Mississauga' },
      { isTop: false, legalName: 'Unknown', city: 'Legacy Town' },
      { isTop: false, legalName: 'Same', city: 'Toronto' },
    ];

    expect(sortStaff(staff, 'Toronto').map((s) => s.legalName)).toEqual([
      'Same',
      'Near',
      'Unknown',
    ]);
  });

  it('falls back to Top then legal name when centre city is unknown', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'Chris', city: 'Toronto' },
      { isTop: true, legalName: 'Zara', city: 'London' },
      { isTop: true, legalName: 'Amy', city: 'Toronto' },
      { isTop: false, legalName: 'Alex', city: 'Mississauga' },
    ];

    expect(sortStaff(staff, 'Legacy Town').map((s) => s.legalName)).toEqual([
      'Amy',
      'Zara',
      'Alex',
      'Chris',
    ]);
  });

  it('does not throw for legacy centre city values', () => {
    const staff: StaffMatchingSortInput[] = [
      { isTop: false, legalName: 'B', city: 'Toronto' },
      { isTop: true, legalName: 'A', city: 'Mississauga' },
    ];

    expect(() => sortStaff(staff, 'North York')).not.toThrow();
    expect(sortStaff(staff, 'North York').map((s) => s.legalName)).toEqual(['A', 'B']);
  });
});
