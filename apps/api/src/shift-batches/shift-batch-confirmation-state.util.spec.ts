import { describe, expect, it } from 'vitest';
import { deriveBatchConfirmationUiState } from './shift-batch-confirmation-state.util';

describe('deriveBatchConfirmationUiState', () => {
  const fullProgress = { activeTotal: 2, fulfilledCount: 2, cancelledCount: 0, percentage: 100 };

  it('returns open when not complete and not ready', () => {
    expect(
      deriveBatchConfirmationUiState(
        { requestCompletedAt: null, confirmationRevision: 0, pendingChangeRevision: 0 },
        { activeTotal: 2, fulfilledCount: 1, cancelledCount: 0, percentage: 50 },
      ),
    ).toBe('open');
  });

  it('returns updates_required when confirmed batch has pending changes', () => {
    expect(
      deriveBatchConfirmationUiState(
        {
          requestCompletedAt: '2026-09-01',
          confirmationRevision: 1,
          pendingChangeRevision: 1,
        },
        fullProgress,
      ),
    ).toBe('ready_to_send_updates');
  });

  it('returns cancelled when batch is cancelled', () => {
    expect(
      deriveBatchConfirmationUiState(
        {
          requestCompletedAt: '2026-09-01',
          confirmationRevision: 1,
          pendingChangeRevision: 0,
          cancelledAt: '2026-09-02',
        },
        fullProgress,
      ),
    ).toBe('cancelled');
  });
});
