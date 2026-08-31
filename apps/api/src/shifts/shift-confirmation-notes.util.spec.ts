import { describe, expect, it } from 'vitest';
import { normalizeShiftConfirmationNotes } from './shift-confirmation-notes.util';

describe('normalizeShiftConfirmationNotes', () => {
  it('returns null for undefined, null, empty, and whitespace', () => {
    expect(normalizeShiftConfirmationNotes(undefined)).toBeNull();
    expect(normalizeShiftConfirmationNotes(null)).toBeNull();
    expect(normalizeShiftConfirmationNotes('')).toBeNull();
    expect(normalizeShiftConfirmationNotes('   ')).toBeNull();
  });

  it('trims non-empty values', () => {
    expect(normalizeShiftConfirmationNotes('  Side entrance  ')).toBe('Side entrance');
  });
});
