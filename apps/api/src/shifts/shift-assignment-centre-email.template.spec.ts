import { describe, expect, it } from 'vitest';
import {
  buildShiftAssignmentCentreEmailContent,
  centreAssignmentEmailContainsNoSensitiveInternals,
} from './shift-assignment-centre-email.template';

describe('buildShiftAssignmentCentreEmailContent', () => {
  const base = {
    centreName: 'ABC Child Care Centre',
    carerLegalName: 'Jane Doe',
    roleNeeded: 'ECE' as string | null,
    shiftDate: '2026-08-25',
    startTime: '08:30:00',
    endTime: '16:30:00',
    shiftConfirmationNotes: '',
    documentShareUrl: 'https://platform.example/documents/jane-doe#token',
  };

  it('includes subject, display name, role, date, time, and document link', () => {
    const content = buildShiftAssignmentCentreEmailContent(base);
    expect(content.subject).toContain('ABC Child Care Centre');
    expect(content.subject).toContain('August');
    expect(content.text).toContain('Jane Doe');
    expect(content.text).toContain('Role: ECE');
    expect(content.text).toContain('8:30 AM');
    expect(content.text).toContain('4:30 PM');
    expect(content.text).toContain(base.documentShareUrl);
    expect(content.html).toContain('Jane Doe');
  });

  it('omits role when blank', () => {
    const content = buildShiftAssignmentCentreEmailContent({ ...base, roleNeeded: null });
    expect(content.text).not.toContain('Role:');
  });

  it('escapes HTML in dynamic values', () => {
    const content = buildShiftAssignmentCentreEmailContent({
      ...base,
      carerLegalName: 'Jane <script>alert(1)</script>',
    });
    expect(content.html).not.toContain('<script>');
    expect(content.html).toContain('&lt;script&gt;');
  });

  it('uses legal full name and never display name for centre-facing copy', () => {
    const content = buildShiftAssignmentCentreEmailContent({
      ...base,
      carerLegalName: 'Jaspreet Singh',
    });
    expect(content.text).toContain('Jaspreet Singh');
    expect(content.text).not.toContain('Jaz');
    expect(content.html).toContain('Jaspreet Singh');
  });

  it('excludes internal shift fields', () => {
    const content = buildShiftAssignmentCentreEmailContent(base);
    expect(centreAssignmentEmailContainsNoSensitiveInternals(content)).toBe(true);
    expect(content.text).not.toContain('cancellation');
  });
});
