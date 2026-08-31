import { vi } from 'vitest';
import type { ShiftBatchCompletionReadinessService } from './shift-batch-completion-readiness.service';
import type { ShiftBatchCompletionService } from './shift-batch-completion.service';

export function createMockShiftBatchCompletionReadinessService(): Pick<
  ShiftBatchCompletionReadinessService,
  'getReadiness'
> {
  return {
    getReadiness: vi.fn().mockResolvedValue({
      ready: false,
      primaryContactEmail: null,
      activeShiftCount: 0,
      fulfilledShiftCount: 0,
      blockers: [],
    }),
  };
}

export function createMockShiftBatchCompletionService(): Pick<
  ShiftBatchCompletionService,
  'complete' | 'retryFinalConfirmation' | 'resolveFinalConfirmationStatus'
> {
  return {
    complete: vi.fn(),
    retryFinalConfirmation: vi.fn(),
    resolveFinalConfirmationStatus: vi.fn().mockResolvedValue({ state: 'none' }),
  };
}
