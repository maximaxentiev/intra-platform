import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpsertStaffDto } from './staff.dto';

function validate(body: Record<string, unknown>) {
  const dto = plainToInstance(UpsertStaffDto, body);
  return validateSync(dto, { forbidNonWhitelisted: true, whitelist: true });
}

const base = {
  legalName: 'Alex Carer',
  displayName: 'Alex C',
  useDisplayName: true,
  phone: '555',
  email: 'alex@example.test',
  role: 'ECA',
  notes: '',
  documentsUrl: '',
  address: '1 Main St',
  city: 'Toronto',
};

describe('UpsertStaffDto', () => {
  it('accepts editable staff fields', () => {
    expect(validate(base)).toHaveLength(0);
  });

  it('rejects legacy employment status field', () => {
    const errors = validate({ ...base, status: 'inactive' });
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });

  it('rejects read-only response fields', () => {
    const errors = validate({
      ...base,
      id: 'staff-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      portalAccount: { accountStatus: 'active' },
    });
    expect(errors.some((e) => e.property === 'id')).toBe(true);
    expect(errors.some((e) => e.property === 'createdAt')).toBe(true);
    expect(errors.some((e) => e.property === 'updatedAt')).toBe(true);
    expect(errors.some((e) => e.property === 'portalAccount')).toBe(true);
  });
});
