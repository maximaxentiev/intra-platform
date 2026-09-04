import { describe, expect, it } from 'vitest';
import {
  batchFinalConfirmationEmailExcludesSensitiveData,
  buildBatchConfirmationFinalEmailContent,
} from './shift-batch-confirmation-final-email.template';

describe('buildBatchConfirmationFinalEmailContent', () => {
  it('renders stacked shift blocks chronologically with legal names and document links', () => {
    const content = buildBatchConfirmationFinalEmailContent({
      centreName: 'ABC Child Care',
      activeShiftCount: 2,
      assignments: [
        {
          assignedStaffId: '11111111-1111-4111-8111-111111111111',
          shiftDate: '2026-09-10',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECE',
          carerLegalName: 'Jane Smith',
          shiftConfirmationNotes: 'Bring RECE docs',
          documentShareUrl: 'https://app.example/documents/jane#token',
        },
        {
          shiftDate: '2026-09-11',
          startTime: '09:00:00',
          endTime: '17:00:00',
          roleNeeded: 'RECE',
          carerLegalName: 'Jane Smith',
          shiftConfirmationNotes: '',
          documentShareUrl: 'https://app.example/documents/jane#token',
        },
      ],
    });

    expect(content.subject).toContain('confirmed');
    expect(content.text).toContain('Shift 1');
    expect(content.text).toContain('Shift 2');
    expect(content.html).toContain('Shift 1');
    expect(content.html).toContain('Shift 2');
    expect(content.html).toContain('padding-bottom:24px');
    expect(content.text).toContain('Jane Smith');
    expect(content.text).toContain('Shift Notes');
    expect(content.text).toContain('Bring RECE docs');
    expect(content.text).toContain('View Carer Documents');
    expect(content.html).not.toContain('<table><tr><td>Date</td><td>Time</td>');
    expect(
      batchFinalConfirmationEmailExcludesSensitiveData({
        html: content.html,
        text: content.text,
        legacyInternalNote: 'legacy internal note secret',
        internalCommentMarker: 'ops-only internal comment',
      }),
    ).toBe(true);
  });

  it('omits Shift Notes section when blank', () => {
    const content = buildBatchConfirmationFinalEmailContent({
      centreName: 'ABC',
      activeShiftCount: 1,
      assignments: [
        {
          assignedStaffId: '11111111-1111-4111-8111-111111111111',
          shiftDate: '2026-09-10',
          startTime: '08:00:00',
          endTime: '16:00:00',
          roleNeeded: 'ECE',
          carerLegalName: 'Jane Smith',
          shiftConfirmationNotes: '   ',
          documentShareUrl: 'https://app.example/documents/jane#token',
        },
      ],
    });

    expect(content.text).not.toContain('Shift Notes:');
    expect(content.html).not.toContain('Shift Notes');
  });
});
