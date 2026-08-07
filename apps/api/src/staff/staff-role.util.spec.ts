import { describe, expect, it } from 'vitest';
import { normalizeStaffRoleFromCsv, STAFF_ROLE_ERROR_MESSAGE } from './staff-role.util';

describe('normalizeStaffRoleFromCsv', () => {
  it('normalizes ECA aliases', () => {
    expect(normalizeStaffRoleFromCsv('ECA')).toBe('ECA');
    expect(normalizeStaffRoleFromCsv('eca')).toBe('ECA');
  });

  it('normalizes ECE aliases', () => {
    expect(normalizeStaffRoleFromCsv('ECE')).toBe('ECE');
    expect(normalizeStaffRoleFromCsv('ece')).toBe('ECE');
    expect(normalizeStaffRoleFromCsv('RECE')).toBe('ECE');
    expect(normalizeStaffRoleFromCsv('ECE/RECE')).toBe('ECE');
    expect(normalizeStaffRoleFromCsv('ECE / RECE')).toBe('ECE');
  });

  it('normalizes Nanny aliases', () => {
    expect(normalizeStaffRoleFromCsv('Nanny')).toBe('Nanny');
    expect(normalizeStaffRoleFromCsv('nanny')).toBe('Nanny');
  });

  it('rejects unknown or ambiguous roles', () => {
    expect(normalizeStaffRoleFromCsv('Teacher')).toBeNull();
    expect(normalizeStaffRoleFromCsv('Assistant')).toBeNull();
    expect(normalizeStaffRoleFromCsv('Childcare Worker')).toBeNull();
    expect(normalizeStaffRoleFromCsv('ECE/Nanny')).toBeNull();
    expect(normalizeStaffRoleFromCsv('')).toBeNull();
  });

  it('exposes a stable validation message', () => {
    expect(STAFF_ROLE_ERROR_MESSAGE).toBe('Role must be ECA, ECE, or Nanny.');
  });
});
