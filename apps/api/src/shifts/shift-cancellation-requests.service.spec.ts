import { BadRequestException, NotFoundException } from '@nestjs/common';
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

import { ShiftCancellationRequestsService } from './shift-cancellation-requests.service';
import { STAFF_PORTAL_AUDIT_EVENTS } from '../staff-portal/staff-portal-audit.service';

const SHIFT_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createHarness() {
  let shiftRow = {
    id: SHIFT_ID,
    assignedStaffId: STAFF_ID,
    status: 'filled' as const,
    shiftDate: '2026-08-20',
    endTime: '16:30:00',
  };

  const pendingRow = {
    id: 'req-1',
    shift_id: SHIFT_ID,
    status: 'pending' as const,
    reason: 'Family emergency',
    requested_at: new Date('2026-08-13T18:00:00.000Z'),
  };

  const audit = {
    record: vi.fn(async () => undefined),
  };

  let insertCalls = 0;

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(async () => [shiftRow]),
          limit: vi.fn(async () => [pendingRow]),
        })),
      })),
    })),
    execute: vi.fn(async () => {
      if (insertCalls === 0) {
        insertCalls += 1;
        return { rows: [pendingRow] };
      }
      return { rows: [] };
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
  };

  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    select: vi.fn(),
    execute: vi.fn(),
    setShiftRow: (patch: Partial<typeof shiftRow>) => {
      shiftRow = { ...shiftRow, ...patch };
    },
  };

  const service = new ShiftCancellationRequestsService(db as never, audit as never);
  return { service, db, audit, tx };
}

describe('ShiftCancellationRequestsService.createCarerRequest', () => {
  it('rejects blank reason', async () => {
    const { service } = createHarness();
    await expect(
      service.createCarerRequest({
        shiftId: SHIFT_ID,
        staffId: STAFF_ID,
        staffAccountId: ACCOUNT_ID,
        reason: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when shift is not assigned to staff', async () => {
    const { service, db } = createHarness();
    db.setShiftRow({ assignedStaffId: 'other-staff' });
    await expect(
      service.createCarerRequest({
        shiftId: SHIFT_ID,
        staffId: STAFF_ID,
        staffAccountId: ACCOUNT_ID,
        reason: 'Valid reason',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects completed shifts', async () => {
    const { service, db } = createHarness();
    db.setShiftRow({ shiftDate: '2026-08-10', endTime: '09:00:00' });
    await expect(
      service.createCarerRequest({
        shiftId: SHIFT_ID,
        staffId: STAFF_ID,
        staffAccountId: ACCOUNT_ID,
        reason: 'Valid reason',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates request and records audit event', async () => {
    const { service, audit } = createHarness();
    const result = await service.createCarerRequest({
      shiftId: SHIFT_ID,
      staffId: STAFF_ID,
      staffAccountId: ACCOUNT_ID,
      reason: 'Family emergency',
    });
    expect(result.status).toBe('pending');
    expect(result.reason).toBe('Family emergency');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        staffId: STAFF_ID,
        staffAccountId: ACCOUNT_ID,
        eventType: STAFF_PORTAL_AUDIT_EVENTS.shiftCancellationRequested,
        detail: expect.objectContaining({ shiftId: SHIFT_ID }),
      }),
      expect.anything(),
    );
  });
});

describe('ShiftCancellationRequestsService.assertCarerCancellationEligible', () => {
  it('allows upcoming and today shifts', () => {
    const { service } = createHarness();
    expect(() =>
      service.assertCarerCancellationEligible('filled', '2026-08-20', '16:30:00'),
    ).not.toThrow();
    expect(() =>
      service.assertCarerCancellationEligible('filled', TEST_TODAY, '16:30:00'),
    ).not.toThrow();
  });

  it('rejects cancelled internal status', () => {
    const { service } = createHarness();
    expect(() =>
      service.assertCarerCancellationEligible('cancelled', '2026-08-20', '16:30:00'),
    ).toThrow(BadRequestException);
  });
});
