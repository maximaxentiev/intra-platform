import { describe, expect, it } from 'vitest';
import {
  buildShiftAssignmentCarerEmailContent,
  carerAssignmentEmailContainsNoSensitiveInternals,
} from './shift-assignment-carer-email.template';

describe('buildShiftAssignmentCarerEmailContent', () => {
  const base = {
    centreName: 'ABC Child Care Centre',
    centreAddress: '123 Main Street',
    centreCity: 'Toronto',
    centreNotes: 'Park in the rear lot.',
    shiftConfirmationNotes: 'Bring indoor shoes.',
    roleNeeded: 'ECE' as string | null,
    shiftDate: '2026-08-25',
    startTime: '08:30:00',
    endTime: '16:30:00',
    shiftId: 'shift-1',
    includePortalLink: true,
    platformEnv: { APP_PUBLIC_URL: 'https://platform.example' },
  };

  it('includes centre, date, time, address, role, notes, and portal link', () => {
    const content = buildShiftAssignmentCarerEmailContent(base);
    expect(content.subject).toContain('ABC Child Care Centre');
    expect(content.text).toContain('Your shift is confirmed.');
    expect(content.text).toContain('123 Main Street');
    expect(content.text).toContain('Toronto');
    expect(content.text).toContain('Role: ECE');
    expect(content.text).toContain('Centre Rules, Policies, and Notes:');
    expect(content.text).toContain('Park in the rear lot.');
    expect(content.text).toContain('Shift Notes:');
    expect(content.text).toContain('Bring indoor shoes.');
    expect(content.text).toContain('/carer/shifts/shift-1');
  });

  it('omits notes and role when empty', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      ...base,
      centreNotes: '',
      shiftConfirmationNotes: '',
      roleNeeded: null,
    });
    expect(content.text).not.toContain('Centre Rules, Policies, and Notes:');
    expect(content.text).not.toContain('Shift Notes:');
    expect(content.text).not.toContain('Role:');
  });

  it('omits portal link when not eligible', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      ...base,
      includePortalLink: false,
    });
    expect(content.text).not.toContain('View shift details');
    expect(content.text).not.toContain('/carer/shifts/');
  });

  it('escapes HTML and excludes sensitive fields', () => {
    const content = buildShiftAssignmentCarerEmailContent({
      ...base,
      centreName: 'Centre & Co <test>',
    });
    expect(content.html).toContain('Centre &amp; Co');
    expect(carerAssignmentEmailContainsNoSensitiveInternals(content)).toBe(true);
  });
});
