import { describe, expect, it } from 'vitest';
import { buildShiftAssignmentCarerEmailContent } from '../shifts/shift-assignment-carer-email.template';
import { buildShiftAssignmentCentreEmailContent } from '../shifts/shift-assignment-centre-email.template';
import { buildBatchConfirmationFinalEmailContent } from '../shift-batches/shift-batch-confirmation-final-email.template';
import { toCarerShiftSummaryDto } from '../staff-portal/carer-shift.util';

const INTERNAL_OPS_SENTINEL = 'INTERNAL_OPS_SENTINEL_DO_NOT_LEAK_92831';
const PUBLIC_CENTRE_NOTES = 'Use rear entrance only.';

describe('Centre internal ops notes communication leakage regression', () => {
  it('does not include internal ops notes in carer assignment email content', () => {
    const { text, html } = buildShiftAssignmentCarerEmailContent({
      centreName: 'ABC Centre',
      centreAddress: '123 Main',
      centreCity: 'Toronto',
      centreNotes: PUBLIC_CENTRE_NOTES,
      shiftConfirmationNotes: 'Room 3',
      roleNeeded: 'ECE',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftId: 'shift-1',
      includePortalLink: true,
      platformEnv: { appPublicUrl: 'https://platform.example' },
    });

    expect(text).toContain(PUBLIC_CENTRE_NOTES);
    expect(text).not.toContain(INTERNAL_OPS_SENTINEL);
    expect(html).not.toContain(INTERNAL_OPS_SENTINEL);
  });

  it('does not include internal ops notes in centre assignment email content', () => {
    const { text, html } = buildShiftAssignmentCentreEmailContent({
      centreName: 'ABC Centre',
      carerLegalName: 'Jane Doe',
      roleNeeded: 'ECE',
      shiftConfirmationNotes: 'Room 3',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      documentShareUrl: 'https://platform.example/share/abc',
    });

    expect(text).not.toContain(INTERNAL_OPS_SENTINEL);
    expect(html).not.toContain(INTERNAL_OPS_SENTINEL);
    expect(text).not.toContain(PUBLIC_CENTRE_NOTES);
  });

  it('does not include internal ops notes in batch centre confirmation email content', () => {
    const { text, html } = buildBatchConfirmationFinalEmailContent({
      centreName: 'ABC Centre',
      activeShiftCount: 1,
      assignments: [
        {
          shiftDate: '2026-08-25',
          startTime: '08:30:00',
          endTime: '16:30:00',
          roleNeeded: 'ECE',
          carerLegalName: 'Jane Doe',
          shiftConfirmationNotes: 'Room 3',
          documentShareUrl: 'https://platform.example/share/batch',
        },
      ],
    });

    expect(text).not.toContain(INTERNAL_OPS_SENTINEL);
    expect(html).not.toContain(INTERNAL_OPS_SENTINEL);
  });

  it('does not expose internal ops notes through carer portal shift mapping', () => {
    const dto = toCarerShiftSummaryDto(
      {
        id: 'shift-1',
        shiftDate: '2026-09-10',
        startTime: '09:00:00',
        endTime: '17:00:00',
        roleNeeded: 'ECE',
        status: 'filled',
        centreName: 'ABC Centre',
        centreAddress: '123 Main',
        centreCity: 'Toronto',
        centreNotes: PUBLIC_CENTRE_NOTES,
      },
      '2026-09-03',
      '12:00',
    );

    expect(dto?.centre.notes).toBe(PUBLIC_CENTRE_NOTES);
    expect(JSON.stringify(dto)).not.toContain(INTERNAL_OPS_SENTINEL);
    expect(dto).not.toHaveProperty('internalOpsNotes');
    expect(dto?.centre).not.toHaveProperty('internalOpsNotes');
  });
});
