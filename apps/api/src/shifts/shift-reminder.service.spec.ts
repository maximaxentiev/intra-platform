import { describe, expect, it, vi } from 'vitest';
import { ShiftReminderService } from './shift-reminder.service';
import { buildShiftReminderIdempotencyKey } from './shift-reminder.types';
import { torontoShiftStartInstant } from './shift-toronto.util';

describe('ShiftReminderService', () => {
  it('builds versioned idempotency keys per assignee and schedule', () => {
    const key = buildShiftReminderIdempotencyKey({
      shiftId: 's1',
      assignedStaffId: 'staff-a',
      shiftDate: '2026-09-10',
      startTime: '09:00:00',
      interval: '3d',
    });
    expect(key).toBe('shift:s1:assignment:staff-a:start:2026-09-10_09-00-00:reminder:3d');
  });

  it('schedules only future intervals inside transaction', async () => {
    const shiftDate = '2026-12-01';
    const startTime = '09:00:00';
    const shiftStart = torontoShiftStartInstant(shiftDate, startTime);
    const now = new Date(shiftStart.getTime() - 2 * 24 * 60 * 60 * 1000);

    const scheduledRows: { id: string; idempotencyKey: string }[] = [];
    const automated = {
      schedule: vi.fn(async (input: { idempotencyKey: string }) => {
        const row = { id: `id-${scheduledRows.length}`, idempotencyKey: input.idempotencyKey };
        scheduledRows.push(row);
        return row;
      }),
      enqueueScheduledCommunication: vi.fn(),
      ensureScheduled: vi.fn(),
      cancelByIdempotencyKeys: vi.fn(),
      cancelByEntity: vi.fn(),
    };

    const service = new ShiftReminderService({} as never, automated as never);
    const ids = await service.scheduleForFilledShift(
      { shiftId: 'shift-1', assignedStaffId: 'staff-1', shiftDate, startTime },
      {} as never,
      now,
    );

    expect(ids).toHaveLength(2);
    expect(automated.schedule).toHaveBeenCalledTimes(2);
    expect(scheduledRows.some((r) => r.idempotencyKey.includes(':reminder:1d'))).toBe(true);
    expect(scheduledRows.some((r) => r.idempotencyKey.includes(':reminder:2h'))).toBe(true);
    expect(scheduledRows.some((r) => r.idempotencyKey.includes(':reminder:3d'))).toBe(false);
  });

  it('cancelPendingForShift limits to shift reminder communication types', async () => {
    const returning = [{ id: 'c1' }];
    const db = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => returning),
          })),
        })),
      })),
    };

    const service = new ShiftReminderService(db as never, {} as never);
    const count = await service.cancelPendingForShift('shift-1');
    expect(count).toBe(1);
    expect(db.update).toHaveBeenCalled();
  });
});
