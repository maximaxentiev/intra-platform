import { describe, expect, it } from 'vitest';
import {
  CentreEmailBodyEditor,
  serializeCentreEmailBodySegments,
  splitCentreEmailBodySegments,
} from '@/components/shifts/CentreEmailBodyEditor';
import { CentreEmailReviewDialog } from '@/components/shifts/CentreEmailReviewDialog';
import { useCentreEmailReview } from '@/lib/use-centre-email-review';
import { previewBatchCentreEmail, previewShiftAssignmentCentreEmail } from '@/lib/centre-email-review';

const STAFF_ID = '11111111-1111-4111-8111-111111111111';

describe('centre email review web wiring', () => {
  it('exports shared review dialog, body editor, and hook', () => {
    expect(CentreEmailReviewDialog).toBeTypeOf('function');
    expect(CentreEmailBodyEditor).toBeTypeOf('function');
    expect(useCentreEmailReview).toBeTypeOf('function');
  });

  it('defines preview API helpers', () => {
    expect(previewShiftAssignmentCentreEmail).toBeTypeOf('function');
    expect(previewBatchCentreEmail).toBeTypeOf('function');
  });
});

describe('CentreEmailBodyEditor segment serialization', () => {
  it('preserves secure document markers when editing surrounding text', () => {
    const segments = splitCentreEmailBodySegments(
      `Hello Centre\n\nDocuments:\n[[INTRA_SECURE_DOC:${STAFF_ID}]]`,
    );
    const edited = segments.map((segment) =>
      segment.type === 'text' ? { ...segment, content: 'Updated greeting\n\nDocuments:\n' } : segment,
    );
    const body = serializeCentreEmailBodySegments(edited);
    expect(body).toContain('Updated greeting');
    expect(body).toContain(`[[INTRA_SECURE_DOC:${STAFF_ID}]]`);
  });
});
