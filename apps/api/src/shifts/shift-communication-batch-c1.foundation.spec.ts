import { describe, expect, it } from 'vitest';
import {
  buildShiftAssignmentCarerEmailContent,
  carerAssignmentEmailExcludesLegacyInternalNotes,
} from './shift-assignment-carer-email.template';
import {
  buildShiftAssignmentCentreEmailContent,
  centreAssignmentEmailExcludesLegacyInternalNotes,
} from './shift-assignment-centre-email.template';
import {
  BATCH_CENTRE_DEFER_MESSAGE,
  SHIFT_COMMUNICATION_DEFER_REASON,
} from './shift-communication-policy.util';

describe('Batch C1 foundation guards', () => {
  it('uses canonical defer reason and copy constants', () => {
    expect(SHIFT_COMMUNICATION_DEFER_REASON.openBatchCentreDeferred).toBe(
      'deferred_batch_confirmation',
    );
    expect(BATCH_CENTRE_DEFER_MESSAGE).toBe(
      'Centre communication is managed through this Batch Request.',
    );
  });

  it('includes Shift Notes in carer assignment email when present', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      centreName: 'ABC Centre',
      centreAddress: '123 Main',
      centreCity: 'Toronto',
      centreNotes: 'Use rear entrance.',
      shiftConfirmationNotes: 'Bring indoor shoes.',
      roleNeeded: 'ECE',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftId: 'shift-1',
      includePortalLink: false,
      platformEnv: {},
    });
    expect(content.text).toContain('Shift Notes:');
    expect(content.text).toContain('Bring indoor shoes.');
    expect(content.text).toContain('Rules, Policies, and Other Notes:');
    expect(content.text).toContain('Use rear entrance.');
  });

  it('omits Shift Notes section when blank', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      centreName: 'ABC Centre',
      centreAddress: '123 Main',
      centreCity: 'Toronto',
      centreNotes: '',
      shiftConfirmationNotes: '',
      roleNeeded: null,
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftId: 'shift-1',
      includePortalLink: false,
      platformEnv: {},
    });
    expect(content.text).not.toContain('Shift Notes:');
  });

  it('includes Shift Notes in individual centre assignment email', () => {
    const content = buildShiftAssignmentCentreEmailContent({
      centreName: 'ABC Centre',
      carerLegalName: 'Jane Doe',
      roleNeeded: 'ECE',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftConfirmationNotes: 'Gate code 1234.',
      documentShareUrl: 'https://example.test/docs',
    });
    expect(content.text).toContain('Shift Notes:');
    expect(content.text).toContain('Gate code 1234.');
  });

  it('never leaks legacy internal shifts.notes into carer or centre emails', () => {
    const legacyNote = 'INTERNAL ONLY: do not share with centre';
    const carer = buildShiftAssignmentCarerEmailContent({
      centreName: 'ABC Centre',
      centreAddress: '123 Main',
      centreCity: 'Toronto',
      centreNotes: 'Centre rules only',
      shiftConfirmationNotes: 'External shift note',
      roleNeeded: 'ECE',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftId: 'shift-1',
      includePortalLink: false,
      platformEnv: {},
    });
    const centre = buildShiftAssignmentCentreEmailContent({
      centreName: 'ABC Centre',
      carerLegalName: 'Jane Doe',
      roleNeeded: 'ECE',
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftConfirmationNotes: 'External shift note',
      documentShareUrl: 'https://example.test/docs',
    });
    expect(carerAssignmentEmailExcludesLegacyInternalNotes({ ...carer, legacyInternalNote: legacyNote })).toBe(true);
    expect(centreAssignmentEmailExcludesLegacyInternalNotes({ ...centre, legacyInternalNote: legacyNote })).toBe(true);
    expect(carer.text).not.toContain(legacyNote);
    expect(centre.text).not.toContain(legacyNote);
  });

  it('escapes HTML in Shift Notes', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      centreName: 'ABC Centre',
      centreAddress: '123 Main',
      centreCity: 'Toronto',
      centreNotes: '',
      shiftConfirmationNotes: '<script>alert(1)</script>',
      roleNeeded: null,
      shiftDate: '2026-08-25',
      startTime: '08:30:00',
      endTime: '16:30:00',
      shiftId: 'shift-1',
      includePortalLink: false,
      platformEnv: {},
    });
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });
});
