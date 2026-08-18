import { vi } from 'vitest';
import type { ShiftCancellationService } from './shift-cancellation.service';

export function createMockShiftCancellationService(): ShiftCancellationService {
  return {
    scheduleForAssignedCancellation: vi.fn().mockResolvedValue([]),
    enqueueScheduledIds: vi.fn().mockResolvedValue(undefined),
  } as unknown as ShiftCancellationService;
}
