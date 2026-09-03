import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CentreUsageShiftsQueryDto } from './centre-usage-shifts-query.dto';

const VALID_CENTRE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbba1';

describe('CentreUsageShiftsQueryDto audience', () => {
  it('accepts ops audience', () => {
    const dto = plainToInstance(CentreUsageShiftsQueryDto, {
      centreIds: [VALID_CENTRE],
      audience: 'ops',
    });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'audience')).toBe(false);
  });

  it('accepts centre audience', () => {
    const dto = plainToInstance(CentreUsageShiftsQueryDto, {
      centreIds: [VALID_CENTRE],
      audience: 'centre',
    });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'audience')).toBe(false);
  });

  it('rejects invalid audience values', () => {
    const dto = plainToInstance(CentreUsageShiftsQueryDto, {
      centreIds: [VALID_CENTRE],
      audience: 'internal',
    });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'audience')).toBe(true);
  });

  it('allows omitted audience for default Ops behavior', () => {
    const dto = plainToInstance(CentreUsageShiftsQueryDto, {
      centreIds: [VALID_CENTRE],
    });
    const errors = validateSync(dto);
    expect(errors.some((error) => error.property === 'audience')).toBe(false);
    expect(dto.audience).toBeUndefined();
  });
});
