import { describe, expect, it } from 'vitest';
import {
  ACTIVE_SHIFT_ROLES,
  formatShiftRoleLabel,
  isActiveShiftRole,
  normalizeShiftRole,
} from './shift-role';

describe('shift role helpers', () => {
  it('normalizes active and legacy shift roles', () => {
    expect(normalizeShiftRole(' eca ')).toBe('ECA');
    expect(normalizeShiftRole('ece')).toBe('ECE');
    expect(normalizeShiftRole('rece')).toBe('RECE');
    expect(normalizeShiftRole('Nanny')).toBe('Nanny');
    expect(normalizeShiftRole('')).toBeNull();
  });

  it('identifies active shift roles for creation', () => {
    expect(ACTIVE_SHIFT_ROLES).toEqual(['ECA', 'ECE', 'RECE']);
    expect(isActiveShiftRole('RECE')).toBe(true);
    expect(isActiveShiftRole('Nanny')).toBe(false);
  });

  it('formats shift role labels for display', () => {
    expect(formatShiftRoleLabel('rece')).toBe('RECE');
    expect(formatShiftRoleLabel('Nanny')).toBe('Nanny');
    expect(formatShiftRoleLabel('')).toBe('—');
  });
});
