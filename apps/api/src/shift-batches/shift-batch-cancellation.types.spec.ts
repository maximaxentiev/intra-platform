import { describe, expect, it } from 'vitest';
import {
  hasBatchCentreConfirmation,
  resolveBatchCancellationCase,
  resolveBatchCancellationRecipients,
} from './shift-batch-cancellation.types';

describe('shift-batch-cancellation.types', () => {
  it('classifies Case A when no centre confirmation and no assigned carers', () => {
    expect(
      resolveBatchCancellationCase(
        { requestCompletedAt: null, confirmationRevision: 0 },
        [
          { id: '1', status: 'pending', assignedStaffId: null, shiftDate: '2026-09-01', startTime: '09:00', endTime: '17:00', roleNeeded: 'ECE' },
        ],
      ),
    ).toBe('A');
  });

  it('classifies Case B when assigned carers exist before centre confirmation', () => {
    expect(
      resolveBatchCancellationCase(
        { requestCompletedAt: null, confirmationRevision: 0 },
        [
          { id: '1', status: 'filled', assignedStaffId: 'staff-1', shiftDate: '2026-09-01', startTime: '09:00', endTime: '17:00', roleNeeded: 'ECE' },
        ],
      ),
    ).toBe('B');
  });

  it('classifies Case C when centre confirmation already sent, including stale batches', () => {
    expect(
      resolveBatchCancellationCase(
        { requestCompletedAt: new Date('2026-09-01'), confirmationRevision: 2 },
        [
          { id: '1', status: 'filled', assignedStaffId: 'staff-1', shiftDate: '2026-09-01', startTime: '09:00', endTime: '17:00', roleNeeded: 'ECE' },
        ],
      ),
    ).toBe('C');
    expect(hasBatchCentreConfirmation({ requestCompletedAt: new Date(), confirmationRevision: 1 })).toBe(true);
  });

  it('forces centre off for Case B even when requested', () => {
    expect(
      resolveBatchCancellationRecipients({
        cancelCase: 'B',
        requested: { centre: true, carer: true },
      }),
    ).toEqual({ centre: false, carer: true });
  });

  it('allows centre and carer for Case C', () => {
    expect(
      resolveBatchCancellationRecipients({
        cancelCase: 'C',
        requested: { centre: true, carer: false },
      }),
    ).toEqual({ centre: true, carer: false });
  });
});
