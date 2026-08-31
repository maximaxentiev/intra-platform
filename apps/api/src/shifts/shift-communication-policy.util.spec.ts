import { describe, expect, it } from 'vitest';
import {
  BATCH_CENTRE_DEFER_MESSAGE,
  SHIFT_COMMUNICATION_DEFER_REASON,
  applyCentreBatchDeferral,
  centreDeferredRecipientResult,
  resolveShiftCommunicationPolicyFromRow,
} from './shift-communication-policy.util';

describe('resolveShiftCommunicationPolicyFromRow', () => {
  it('defers centre communication for open batch child', () => {
    const policy = resolveShiftCommunicationPolicyFromRow({
      batchId: 'batch-1',
      requestCompletedAt: null,
    });
    expect(policy.centreCommunicationDeferred).toBe(true);
    expect(policy.centreDeferReason).toBe(
      SHIFT_COMMUNICATION_DEFER_REASON.openBatchCentreDeferred,
    );
  });

  it('restores centre communication after batch completion', () => {
    const policy = resolveShiftCommunicationPolicyFromRow({
      batchId: 'batch-1',
      requestCompletedAt: new Date('2026-08-01'),
    });
    expect(policy.centreCommunicationDeferred).toBe(false);
    expect(policy.batchRequestCompleted).toBe(true);
  });

  it('does not defer individual shifts', () => {
    const policy = resolveShiftCommunicationPolicyFromRow({
      batchId: null,
      requestCompletedAt: null,
    });
    expect(policy.centreCommunicationDeferred).toBe(false);
  });
});

describe('centreDeferredRecipientResult', () => {
  it('marks deferred without attempting send', () => {
    const result = centreDeferredRecipientResult();
    expect(result).toEqual({
      attempted: false,
      sent: false,
      deferred: true,
      skippedReason: SHIFT_COMMUNICATION_DEFER_REASON.openBatchCentreDeferred,
    });
  });
});

describe('applyCentreBatchDeferral', () => {
  it('overrides available centre probe for open batch', () => {
    const deferred = applyCentreBatchDeferral(
      { available: true },
      resolveShiftCommunicationPolicyFromRow({ batchId: 'batch-1', requestCompletedAt: null }),
    );
    expect(deferred.available).toBe(false);
    expect(deferred.reason).toBe(BATCH_CENTRE_DEFER_MESSAGE);
    expect(deferred.unavailableCode).toBe('deferred_open_batch');
  });

  it('preserves document-share unavailability for completed batch', () => {
    const probe = {
      available: false,
      reason: 'Carer document share is unavailable for centre confirmation.',
      unavailableCode: 'document_share_unavailable' as const,
    };
    const result = applyCentreBatchDeferral(
      probe,
      resolveShiftCommunicationPolicyFromRow({
        batchId: 'batch-1',
        requestCompletedAt: new Date(),
      }),
    );
    expect(result).toEqual(probe);
  });
});
