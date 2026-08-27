import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword } from './password.util';

describe('generateTemporaryPassword', () => {
  it('generates passwords with required character classes', () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBeGreaterThanOrEqual(16);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[!@#$%&*+\-=?]/.test(password)).toBe(true);
  });

  it('generates distinct values across repeated calls', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
