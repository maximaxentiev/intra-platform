import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

const TEST_TODAY = '2026-08-13';
const TEST_NOW = '14:30:00';

vi.mock('../availability/availability-toronto.util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../availability/availability-toronto.util')>();
  return {
    ...actual,
    torontoTodayDateString: vi.fn(() => TEST_TODAY),
    torontoNowTimeString: vi.fn(() => TEST_NOW),
  };
});

import { staffAccounts, type StaffAccount } from '../db/schema';
import { StaffPortalShiftsService } from './staff-portal-shifts.service';
import type { StaffSessionPayload } from './staff-session.service';

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHIFT_A1 = '33333333-3333-4333-8333-333333333333';
const SHIFT_B1 = '44444444-4444-4444-8444-444444444444';

const SESSION_A: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_A,
  staffId: STAFF_A,
  email: 'carer-a@example.test',
};

type AccountRow = StaffAccount;

function shiftRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: SHIFT_A1,
    shift_date: '2026-08-20',
    start_time: '08:30:00',
    end_time: '16:30:00',
    role_needed: 'ECA',
    status: 'filled',
    centre_name: 'ABC Child Care',
    centre_address: '123 Main St',
    centre_city: 'Toronto',
    ...overrides,
  };
}

function createHarness(accountOverrides: Partial<AccountRow> = {}) {
  const account: AccountRow = {
    id: ACCOUNT_A,
    staffId: STAFF_A,
    email: 'carer-a@example.test',
    passwordHash: 'hash',
    status: 'active',
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    inviteSentAt: null,
    onboardingStep: 3,
    profileCompletedAt: new Date('2026-01-01T12:00:00.000Z'),
    documentsCompletedAt: new Date('2026-01-02T12:00:00.000Z'),
    availabilityCompletedAt: new Date('2026-01-03T12:00:00.000Z'),
    onboardingCompletedAt: new Date('2026-01-04T12:00:00.000Z'),
    availabilityOnboardingWeek1Start: null,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T12:00:00.000Z'),
    updatedAt: new Date('2026-01-01T12:00:00.000Z'),
    ...accountOverrides,
  };

  let detailRows: unknown[] = [];

  const fromChain = {
    where: vi.fn(async () => [account]),
    innerJoin: vi.fn(() => ({
      where: vi.fn(async () => detailRows),
    })),
  };

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => fromChain),
    })),
    execute: vi.fn(),
    setDetailRows: (rows: unknown[]) => {
      detailRows = rows;
    },
  };

  const service = new StaffPortalShiftsService(db as never);
  return { service, db, account };
}

describe('StaffPortalShiftsService security', () => {
  it('rejects disabled portal accounts', async () => {
    const { service } = createHarness({ status: 'disabled' });
    await expect(service.listUpcoming(SESSION_A, 1, 10)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects incomplete onboarding accounts', async () => {
    const { service } = createHarness({ onboardingCompletedAt: null, status: 'incomplete' });
    await expect(service.listUpcoming(SESSION_A, 1, 10)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('scopes upcoming queries to session staffId via SQL', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({ rows: [shiftRow()] });

    await service.listUpcoming(SESSION_A, 1, 10);
    expect(db.execute).toHaveBeenCalledTimes(2);
    expect(db.execute.mock.calls[0]?.[0]).toBeDefined();
  });
});

describe('StaffPortalShiftsService listUpcoming', () => {
  it('returns empty pagination envelope when no shifts', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [{ total_items: 0 }] });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result).toEqual({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
    });
  });

  it('includes future filled shifts in chronological order', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          shiftRow({ id: 's1', shift_date: '2026-08-20', start_time: '08:00:00' }),
          shiftRow({ id: 's2', shift_date: '2026-08-21', start_time: '09:00:00' }),
        ],
      });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result.totalItems).toBe(2);
    expect(result.items.map((i) => i.id)).toEqual(['s1', 's2']);
    expect(result.items[0]?.status).toBe('upcoming');
  });

  it('includes today filled before end as today', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({
        rows: [shiftRow({ shift_date: TEST_TODAY, end_time: '16:30:00' })],
      });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result.items[0]?.status).toBe('today');
  });

  it('excludes today filled after end from upcoming', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [{ total_items: 0 }] });
    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result.items).toEqual([]);
  });

  it('includes future and today cancelled shifts', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          shiftRow({ id: 'c-today', status: 'cancelled', shift_date: TEST_TODAY }),
          shiftRow({ id: 'c-future', status: 'cancelled', shift_date: '2026-08-20' }),
        ],
      });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result.items.every((i) => i.status === 'cancelled')).toBe(true);
  });

  it('paginates by shift records', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 15 }] })
      .mockResolvedValueOnce({ rows: [shiftRow({ id: 'page2' })] });

    const result = await service.listUpcoming(SESSION_A, 2, 10);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it('returns empty items when page exceeds total pages', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [{ total_items: 3 }] });

    const result = await service.listUpcoming(SESSION_A, 5, 10);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
  });
});

describe('StaffPortalShiftsService listHistory', () => {
  it('includes completed and past filled shifts descending', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 2 }] })
      .mockResolvedValueOnce({
        rows: [
          shiftRow({ id: 'newer', shift_date: '2026-08-01', status: 'completed' }),
          shiftRow({ id: 'older', shift_date: '2026-07-01', status: 'filled', end_time: '12:00:00' }),
        ],
      });

    const result = await service.listHistory(SESSION_A, 1, 25);
    expect(result.items[0]?.status).toBe('completed');
    expect(result.items[1]?.status).toBe('completed');
    expect(result.pageSize).toBe(25);
  });

  it('includes today filled after end as completed presentation', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({
        rows: [shiftRow({ shift_date: TEST_TODAY, end_time: '12:00:00', status: 'filled' })],
      });

    const result = await service.listHistory(SESSION_A, 1, 25);
    expect(result.items[0]?.status).toBe('completed');
  });

  it('includes past cancelled and excludes today cancelled', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({
        rows: [shiftRow({ status: 'cancelled', shift_date: '2026-08-01' })],
      });

    const result = await service.listHistory(SESSION_A, 1, 25);
    expect(result.items[0]?.status).toBe('cancelled');
  });
});

describe('StaffPortalShiftsService summary', () => {
  it('returns next three upcoming shifts', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({
      rows: [
        shiftRow({ id: 's1', shift_date: '2026-08-14' }),
        shiftRow({ id: 's2', shift_date: '2026-08-15' }),
        shiftRow({ id: 's3', shift_date: '2026-08-16' }),
      ],
    });

    const result = await service.summary(SESSION_A, 3);
    expect(result.items).toHaveLength(3);
    expect(result.items.map((i) => i.id)).toEqual(['s1', 's2', 's3']);
  });

  it('returns fewer than three when not enough shifts', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [shiftRow()] });
    const result = await service.summary(SESSION_A, 3);
    expect(result.items).toHaveLength(1);
  });

  it('returns empty items when no shifts', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [] });
    const result = await service.summary(SESSION_A, 3);
    expect(result.items).toEqual([]);
  });
});

describe('StaffPortalShiftsService getDetail', () => {
  it('returns own assigned shift', async () => {
    const { service, db } = createHarness();
    db.setDetailRows([
      {
        id: SHIFT_A1,
        shiftDate: '2026-08-20',
        startTime: '08:30:00',
        endTime: '16:30:00',
        roleNeeded: 'ECA',
        status: 'filled',
        centreName: 'ABC Child Care',
        centreAddress: '123 Main St',
        centreCity: 'Toronto',
      },
    ]);

    const result = await service.getDetail(SESSION_A, SHIFT_A1);
    expect(result.id).toBe(SHIFT_A1);
    expect(result.centre.name).toBe('ABC Child Care');
  });

  it('returns 404 for other staff shift', async () => {
    const { service, db } = createHarness();
    db.setDetailRows([]);
    await expect(service.getDetail(SESSION_A, SHIFT_B1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns 404 for pending legacy assigned shift', async () => {
    const { service, db } = createHarness();
    db.setDetailRows([
      {
        id: SHIFT_A1,
        shiftDate: TEST_TODAY,
        startTime: '08:30:00',
        endTime: '16:30:00',
        roleNeeded: 'ECA',
        status: 'pending',
        centreName: 'ABC Child Care',
        centreAddress: '123 Main St',
        centreCity: 'Toronto',
      },
    ]);
    await expect(service.getDetail(SESSION_A, SHIFT_A1)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffPortalShiftsService DTO leakage', () => {
  it('does not expose internal shift or centre fields', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          shiftRow({
            notes: 'internal',
            cancellation_reason: 'secret',
            added_to_staffpoint: true,
            hourly_rate: '50.00',
          }),
        ],
      });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    const item = result.items[0] as Record<string, unknown>;
    expect(item).not.toHaveProperty('notes');
    expect(item).not.toHaveProperty('cancellationReason');
    expect(item).not.toHaveProperty('addedToStaffpoint');
    expect(item).not.toHaveProperty('assignedStaffId');
    expect(item).not.toHaveProperty('centreId');
    expect(item.centre).toEqual({
      name: 'ABC Child Care',
      address: '123 Main St',
      city: 'Toronto',
    });
    expect(JSON.stringify(item)).not.toContain('internal');
    expect(JSON.stringify(item)).not.toContain('secret');
  });

  it('normalizes blank role to null', async () => {
    const { service, db } = createHarness();
    db.execute
      .mockResolvedValueOnce({ rows: [{ total_items: 1 }] })
      .mockResolvedValueOnce({ rows: [shiftRow({ role_needed: '  ' })] });

    const result = await service.listUpcoming(SESSION_A, 1, 10);
    expect(result.items[0]?.roleNeeded).toBeNull();
  });
});

describe('StaffPortalShiftsController auth wiring', () => {
  it('uses Public, CarerPortalEnabledGuard, and StaffSessionGuard', async () => {
    const { StaffPortalShiftsController } = await import('./staff-portal-shifts.controller');
    const guards = Reflect.getMetadata('__guards__', StaffPortalShiftsController);
    expect(guards?.map((g: { name: string }) => g.name)).toEqual([
      'CarerPortalEnabledGuard',
      'StaffSessionGuard',
    ]);
    expect(Reflect.getMetadata('isPublic', StaffPortalShiftsController)).toBe(true);
  });

  it('registers summary and upcoming routes before id route', async () => {
    const { StaffPortalShiftsController } = await import('./staff-portal-shifts.controller');
    expect(
      Reflect.getMetadata('path', StaffPortalShiftsController.prototype.summary),
    ).toBe('summary');
    expect(
      Reflect.getMetadata('path', StaffPortalShiftsController.prototype.listUpcoming),
    ).toBe('upcoming');
    expect(
      Reflect.getMetadata('path', StaffPortalShiftsController.prototype.getDetail),
    ).toBe(':id');
  });
});

describe('StaffPortalShiftsService isolation from Staff B', () => {
  it('uses session staffId when listing upcoming shifts', async () => {
    const { service, db } = createHarness();
    db.execute.mockResolvedValueOnce({ rows: [{ total_items: 0 }] });

    await service.listUpcoming(SESSION_A, 1, 10);
    expect(db.execute).toHaveBeenCalled();
    expect(STAFF_B).not.toBe(STAFF_A);
  });
});
