import { describe, expect, it } from 'vitest';
import { CentreEmailReviewDialog } from '@/components/shifts/CentreEmailReviewDialog';
import { useCentreEmailReview } from '@/lib/use-centre-email-review';
import { previewBatchCentreEmail, previewShiftAssignmentCentreEmail } from '@/lib/centre-email-review';

describe('centre email review web wiring', () => {
  it('exports shared review dialog and hook', () => {
    expect(CentreEmailReviewDialog).toBeTypeOf('function');
    expect(useCentreEmailReview).toBeTypeOf('function');
  });

  it('defines preview API helpers', () => {
    expect(previewShiftAssignmentCentreEmail).toBeTypeOf('function');
    expect(previewBatchCentreEmail).toBeTypeOf('function');
  });
});
