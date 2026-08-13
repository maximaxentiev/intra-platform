import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateStaffPortalAvailabilityDto } from '../staff-portal/dto/staff-portal-availability.dto';

describe('CreateStaffPortalAvailabilityDto', () => {
  it('rejects unexpected staffId in body', async () => {
    const dto = plainToInstance(CreateStaffPortalAvailabilityDto, {
      weekStartDate: '2026-08-10',
      dayOfWeek: 0,
      startTime: '09:00',
      endTime: '17:00',
      staffId: 'another-staff-id',
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((e) => e.property === 'staffId')).toBe(true);
  });
});
