import { describe, expect, it } from 'vitest';
import {
  shiftAssignmentFeedbackMessage,
  shiftResendFeedbackMessage,
} from './shift-assignment-feedback';

describe('shift assignment feedback messages', () => {
  it('shows already assigned copy without email success', () => {
    expect(
      shiftAssignmentFeedbackMessage('Jane Doe', { changed: false, alreadyAssigned: true }, null),
    ).toBe('Jane Doe is already assigned to this shift.');
  });

  it('shows success when both emails sent', () => {
    expect(
      shiftAssignmentFeedbackMessage(
        'Jane Doe',
        { changed: true, alreadyAssigned: false },
        {
          centre: { attempted: true, sent: true },
          carer: { attempted: true, sent: true },
        },
      ),
    ).toBe('Jane Doe assigned. Confirmation emails sent.');
  });

  it('warns when centre primary contact is missing', () => {
    expect(
      shiftAssignmentFeedbackMessage(
        'Jane Doe',
        { changed: true, alreadyAssigned: false },
        {
          centre: { attempted: false, sent: false, skippedReason: 'no_centre_primary_contact' },
          carer: { attempted: true, sent: true },
        },
      ),
    ).toBe('Jane Doe assigned. No centre primary contact email is configured.');
  });

  it('warns on partial resend failure', () => {
    expect(
      shiftResendFeedbackMessage({
        centre: { attempted: true, sent: false },
        carer: { attempted: true, sent: true },
      }),
    ).toBe('Some confirmation emails could not be sent.');
  });
});
