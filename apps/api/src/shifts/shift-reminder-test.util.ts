import { vi } from 'vitest';
import type { ShiftReminderService } from './shift-reminder.service';

export function createMockShiftReminderService(): ShiftReminderService {
  return {
    cancelPendingForShift: vi.fn().mockResolvedValue(0),
    scheduleForFilledShift: vi.fn().mockResolvedValue([]),
    enqueueScheduledIds: vi.fn().mockResolvedValue(undefined),
    rescheduleFilledShift: vi.fn().mockResolvedValue([]),
    enqueuePendingRemindersForShift: vi.fn().mockResolvedValue(undefined),
    reconcileFutureFilledShifts: vi.fn().mockResolvedValue({ ensured: 0, enqueued: 0 }),
  } as unknown as ShiftReminderService;
}
