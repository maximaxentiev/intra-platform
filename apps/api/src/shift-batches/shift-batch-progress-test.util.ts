import { vi } from 'vitest';
import type { ShiftBatchProgressCommunicationService } from './shift-batch-progress-communication.service';

export function createMockShiftBatchProgressCommunicationService(): Pick<
  ShiftBatchProgressCommunicationService,
  | 'maybeEvaluateAfterFulfillmentChange'
  | 'evaluateAndSchedule'
  | 'enqueueScheduledId'
  | 'resolveProgressEmailStatus'
  | 'retryProgressEmail'
> {
  return {
    maybeEvaluateAfterFulfillmentChange: vi.fn().mockResolvedValue(undefined),
    evaluateAndSchedule: vi.fn().mockResolvedValue(null),
    enqueueScheduledId: vi.fn().mockResolvedValue(undefined),
    resolveProgressEmailStatus: vi.fn().mockResolvedValue({ state: 'none' }),
    retryProgressEmail: vi.fn(),
  };
}
