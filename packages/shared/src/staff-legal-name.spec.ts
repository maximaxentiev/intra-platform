import { describe, expect, it } from 'vitest';
import { getStaffLegalFullName } from './staff-legal-name';

describe('getStaffLegalFullName', () => {
  it('joins legal first and last name with a single space', () => {
    expect(
      getStaffLegalFullName({
        legalFirstName: 'Jaspreet',
        legalLastName: 'Singh',
        legalName: 'Legacy Name',
      }),
    ).toBe('Jaspreet Singh');
  });

  it('trims whitespace from name parts', () => {
    expect(
      getStaffLegalFullName({
        legalFirstName: '  Alex  ',
        legalLastName: '  Carer ',
      }),
    ).toBe('Alex Carer');
  });

  it('falls back to legalName when first/last are empty', () => {
    expect(
      getStaffLegalFullName({
        legalFirstName: '',
        legalLastName: '',
        legalName: 'Janet Doe',
      }),
    ).toBe('Janet Doe');
  });

  it('never uses displayName even when passed alongside other fields', () => {
    const name = getStaffLegalFullName({
      legalFirstName: 'Jaspreet',
      legalLastName: 'Singh',
      legalName: 'Jaz',
    });
    expect(name).toBe('Jaspreet Singh');
    expect(name).not.toContain('Jaz');
  });
});
