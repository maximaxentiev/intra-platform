import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  assertActiveShiftRoleForCreate,
  assertShiftRoleUpdateAllowed,
} from './shift-role-update.util';

describe('assertActiveShiftRoleForCreate', () => {
  it.each(['ECA', 'ECE', 'RECE'] as const)('allows %s', (roleNeeded) => {
    expect(() => assertActiveShiftRoleForCreate(roleNeeded)).not.toThrow();
  });

  it('rejects Nanny on create', () => {
    expect(() => assertActiveShiftRoleForCreate('Nanny')).toThrow(BadRequestException);
  });
});

describe('assertShiftRoleUpdateAllowed', () => {
  it.each(['ECA', 'ECE', 'RECE'] as const)(
    'rejects changing an active %s shift to Nanny',
    (existing) => {
      expect(() => assertShiftRoleUpdateAllowed(existing, 'Nanny')).toThrow(BadRequestException);
    },
  );

  it('allows a historical Nanny shift to remain Nanny', () => {
    expect(() => assertShiftRoleUpdateAllowed('Nanny', 'Nanny')).not.toThrow();
  });

  it.each(['ECA', 'ECE', 'RECE'] as const)(
    'allows upgrading a historical Nanny shift to %s',
    (next) => {
      expect(() => assertShiftRoleUpdateAllowed('Nanny', next)).not.toThrow();
    },
  );

  it.each([
    ['ECA', 'ECE'],
    ['ECE', 'RECE'],
    ['RECE', 'ECA'],
  ] as const)('allows active role changes from %s to %s', (existing, next) => {
    expect(() => assertShiftRoleUpdateAllowed(existing, next)).not.toThrow();
  });

  it('allows edits that omit roleNeeded', () => {
    expect(() => assertShiftRoleUpdateAllowed('Nanny', undefined)).not.toThrow();
    expect(() => assertShiftRoleUpdateAllowed('ECA', undefined)).not.toThrow();
  });
});
