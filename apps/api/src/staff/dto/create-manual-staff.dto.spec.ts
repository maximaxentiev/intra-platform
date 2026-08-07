import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateManualStaffDto } from './create-manual-staff.dto';

function validate(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateManualStaffDto, body);
  return validateSync(dto);
}

const base = {
  displayName: 'Alex C',
  legalFirstName: 'Alex',
  legalLastName: 'Carer',
  email: 'alex@example.test',
  phone: '555',
  address: '1 Main',
  city: 'Toronto',
};

describe('CreateManualStaffDto', () => {
  it.each(['ECA', 'ECE', 'Nanny'] as const)('accepts role %s', (role) => {
    expect(validate({ ...base, role })).toHaveLength(0);
  });

  it('rejects missing role', () => {
    const errors = validate({ ...base });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });

  it('rejects unknown role', () => {
    const errors = validate({ ...base, role: 'Teacher' });
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });
});
