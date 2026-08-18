import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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

import { StaffPortalShiftsService } from './staff-portal-shifts.service';
import type { StaffSessionPayload } from './staff-session.service';

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SHIFT_ID = '33333333-3333-4333-8333-333333333333';

const SESSION_A: StaffSessionPayload = {
  kind: 'staff',
  accountId: ACCOUNT_A,
  staffId: STAFF_A,
  email: 'carer-a@example.test',
};

function createCancelHarness() {
  let shiftRow = {
    id: SHIFT_ID,
    shiftDate: '2026-08-20',
    startTime: '08:30:00',
    endTime: '16:30:00',
    roleNeeded: 'ECA',
    status: 'filled' as const,
    assignedStaffId: STAFF_A,
    centreName: 'ABC Child Care',
    centreAddress: '123 Main St',
    centreCity: 'Toronto',
  };

  const account = {
    id: ACCOUNT_A,
    staffId: STAFF_A,
    status: 'active' as const,
    onboardingCompletedAt: new Date('2026-01-04T12:00:00.000Z'),
  };

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(async () => [shiftRow]),
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => [
            {
              id: shiftRow.id,
              shiftDate: shiftRow.shiftDate,
              startTime: shiftRow.startTime,
              endTime: shiftRow.endTime,
              roleNeeded: shiftRow.roleNeeded,
              status: 'cancelled',
              cancellationReason: 'Family emergency',
            },
          ]),
        })),
      })),
    })),
  };

  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => [account]),
      })),
    })),
    setShiftRow: (patch: Partial<typeof shiftRow>) => {
      shiftRow = { ...shiftRow, ...patch };
    },
    setUpdateRows: (rows: unknown[]) => {
      tx.update = vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => rows),
          })),
        })),
      }));
    },
  };

  const shiftReminders = {
    cancelPendingForShift: vi.fn(async () => 0),
  };

  const service = new StaffPortalShiftsService(db as never, shiftReminders as never);
  return { service, db, shiftRow: () => shiftRow, shiftReminders };
}

describe('StaffPortalShiftsService.cancelShift', () => {
  it('cancels an eligible own upcoming shift and returns cancelled DTO', async () => {
    const { service, shiftReminders } = createCancelHarness();
    const result = await service.cancelShift(SESSION_A, SHIFT_ID, 'Family emergency');
    expect(result.status).toBe('cancelled');
    expect(result.cancellationReason).toBe('Family emergency');
    expect(shiftReminders.cancelPendingForShift).toHaveBeenCalledWith(SHIFT_ID, expect.anything());
  });

  it('rejects blank reason', async () => {
    const { service } = createCancelHarness();
    await expect(service.cancelShift(SESSION_A, SHIFT_ID, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns 404 when shift belongs to another staff member', async () => {
    const { service, db } = createCancelHarness();
    db.setShiftRow({ assignedStaffId: STAFF_B });
    await expect(
      service.cancelShift(SESSION_A, SHIFT_ID, 'Valid reason'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects already cancelled shift', async () => {
    const { service, db } = createCancelHarness();
    db.setShiftRow({ status: 'cancelled' });
    await expect(
      service.cancelShift(SESSION_A, SHIFT_ID, 'Valid reason'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects completed/past filled shift', async () => {
    const { service, db } = createCancelHarness();
    db.setShiftRow({ shiftDate: '2026-08-01', endTime: '09:00:00' });
    await expect(
      service.cancelShift(SESSION_A, SHIFT_ID, 'Valid reason'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when atomic update matches no row (reassignment race)', async () => {
    const { service, db } = createCancelHarness();
    db.setUpdateRows([]);
    await expect(
      service.cancelShift(SESSION_A, SHIFT_ID, 'Valid reason'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
