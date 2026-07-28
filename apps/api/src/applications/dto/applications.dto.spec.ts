import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_ROLES,
  APPLICATION_STATUSES,
  ListApplicationsQuery,
} from './applications.dto';

describe('ListApplicationsQuery', () => {
  it('accepts valid role and status filters', async () => {
    for (const role of APPLICATION_ROLES) {
      const dto = plainToInstance(ListApplicationsQuery, { role });
      expect(await validate(dto)).toHaveLength(0);
    }
    for (const status of APPLICATION_STATUSES) {
      const dto = plainToInstance(ListApplicationsQuery, { status });
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('rejects invalid role and status values', async () => {
    const badRole = plainToInstance(ListApplicationsQuery, { role: 'invalid' });
    expect((await validate(badRole)).length).toBeGreaterThan(0);

    const badStatus = plainToInstance(ListApplicationsQuery, { status: 'pending' });
    expect((await validate(badStatus)).length).toBeGreaterThan(0);
  });

  it('accepts search and pagination bounds', async () => {
    const dto = plainToInstance(ListApplicationsQuery, {
      q: 'jane@example.com',
      limit: 50,
      offset: 10,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects pagination outside allowed bounds', async () => {
    const tooHigh = plainToInstance(ListApplicationsQuery, { limit: 101 });
    expect((await validate(tooHigh)).length).toBeGreaterThan(0);

    const tooLow = plainToInstance(ListApplicationsQuery, { limit: 0 });
    expect((await validate(tooLow)).length).toBeGreaterThan(0);

    const badOffset = plainToInstance(ListApplicationsQuery, { offset: -1 });
    expect((await validate(badOffset)).length).toBeGreaterThan(0);
  });
});
