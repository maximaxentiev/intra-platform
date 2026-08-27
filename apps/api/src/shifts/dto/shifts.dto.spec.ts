import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateShiftDto, UpsertShiftDto } from './shifts.dto';

function validateCreate(body: Record<string, unknown>) {
  return validateSync(plainToInstance(UpsertShiftDto, body));
}

function validateUpdate(body: Record<string, unknown>) {
  return validateSync(plainToInstance(UpdateShiftDto, body));
}

const baseCreate = {
  centreId: '11111111-1111-4111-8111-111111111111',
  shiftDate: '2026-09-15',
  startTime: '08:00:00',
  endTime: '16:00:00',
};

describe('UpsertShiftDto roleNeeded', () => {
  it.each(['ECA', 'ECE', 'RECE'] as const)('accepts %s on create', (roleNeeded) => {
    expect(validateCreate({ ...baseCreate, roleNeeded })).toHaveLength(0);
  });

  it('rejects Nanny on create', () => {
    const errors = validateCreate({ ...baseCreate, roleNeeded: 'Nanny' });
    expect(errors.some((error) => error.property === 'roleNeeded')).toBe(true);
  });
});

describe('UpdateShiftDto roleNeeded', () => {
  it('accepts Nanny for legacy update payloads', () => {
    expect(validateUpdate({ roleNeeded: 'Nanny' })).toHaveLength(0);
  });
});
