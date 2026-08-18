import { describe, expect, it, vi } from 'vitest';
import { ShiftCancellationService } from './shift-cancellation.service';
import {
  buildShiftCancellationIdempotencyKey,
  deriveCancellationVersion,
} from './shift-cancellation.types';

describe('ShiftCancellationService', () => {
  it('builds versioned idempotency keys per recipient', () => {
    const version = deriveCancellationVersion(new Date('2026-08-18T16:00:00.000Z'));
    expect(
      buildShiftCancellationIdempotencyKey({
        shiftId: 'shift-1',
        cancellationVersion: version,
        recipient: 'centre',
      }),
    ).toBe(`shift:shift-1:cancellation:${version}:centre`);
  });

  it('schedules centre and carer cancellation rows', async () => {
    const scheduledFor = new Date('2026-08-18T16:00:00.000Z');
    const automated = {
      schedule: vi.fn(async (input: { idempotencyKey: string }) => ({
        id: `id-${input.idempotencyKey.slice(-6)}`,
      })),
    };

    const service = new ShiftCancellationService({} as never, automated as never);
    const ids = await service.scheduleForAssignedCancellation(
      {
        shiftId: 'shift-1',
        assignedStaffId: 'staff-1',
        centreId: 'centre-1',
        scheduledFor,
      },
      {} as never,
    );

    expect(ids).toHaveLength(2);
    expect(automated.schedule).toHaveBeenCalledTimes(2);
    const keys = automated.schedule.mock.calls.map((c) => c[0].idempotencyKey);
    expect(keys.some((k) => k.endsWith(':centre'))).toBe(true);
    expect(keys.some((k) => k.endsWith(':carer'))).toBe(true);
  });
});
