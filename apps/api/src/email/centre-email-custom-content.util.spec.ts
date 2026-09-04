import { describe, expect, it } from 'vitest';
import {
  normalizeCentreEmailCustomContent,
  renderCentreEmailCustomMessageHtml,
  validateCentreEmailBody,
  validateCentreEmailSubject,
} from './centre-email-custom-content.util';
import { buildShiftAssignmentCentreEmailContent } from '../shifts/shift-assignment-centre-email.template';

const ASSIGNED_STAFF_ID = '11111111-1111-4111-8111-111111111111';

describe('centre-email-custom-content.util', () => {
  it('requires a non-empty trimmed subject', () => {
    expect(() => validateCentreEmailSubject('   ')).toThrow('Centre email subject is required.');
  });

  it('escapes HTML in custom message rendering', () => {
    const html = renderCentreEmailCustomMessageHtml(`<script>alert('x')</script><b>hello</b>`);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;hello&lt;/b&gt;');
  });

  it('preserves default assignment email when no custom content provided', () => {
    const params = {
      centreName: 'Sunrise Centre',
      carerLegalName: 'Jaspreet Singh',
      assignedStaffId: ASSIGNED_STAFF_ID,
      roleNeeded: 'ECE',
      shiftDate: '2026-09-05',
      startTime: '09:00:00',
      endTime: '17:00:00',
      shiftConfirmationNotes: 'Bring ID',
      documentShareUrl: 'https://example.test/share/abc',
    };
    const baseline = buildShiftAssignmentCentreEmailContent(params);
    const withDefaults = buildShiftAssignmentCentreEmailContent({
      ...params,
      customSubject: baseline.defaultSubject,
      customBody: baseline.defaultBody,
    });
    expect(withDefaults.subject).toBe(baseline.subject);
    expect(withDefaults.text).toBe(baseline.text);
    expect(withDefaults.html).toBe(baseline.html);
  });

  it('applies custom subject and full body', () => {
    const customBody = [
      'Custom greeting',
      '',
      'Carer: Jaspreet Singh',
      'Time: 9:00 AM – 5:00 PM',
      '',
      `View documents:\n[[INTRA_SECURE_DOC:${ASSIGNED_STAFF_ID}]]`,
    ].join('\n');
    const content = buildShiftAssignmentCentreEmailContent({
      centreName: 'Sunrise Centre',
      carerLegalName: 'Jaspreet Singh',
      assignedStaffId: ASSIGNED_STAFF_ID,
      roleNeeded: null,
      shiftDate: '2026-09-05',
      startTime: '09:00:00',
      endTime: '17:00:00',
      shiftConfirmationNotes: '',
      documentShareUrl: 'https://example.test/share/abc',
      customSubject: 'Updated staffing confirmation for Friday',
      customBody,
    });
    expect(content.subject).toBe('Updated staffing confirmation for Friday');
    expect(content.text).toContain('Custom greeting');
    expect(content.text).toContain('9:00 AM – 5:00 PM');
    expect(content.html).toContain('Custom greeting');
  });

  it('normalizes custom content against defaults', () => {
    const resolved = normalizeCentreEmailCustomContent(
      { subject: 'Custom', body: 'Hello' },
      { subject: 'Default subject', body: '' },
    );
    expect(resolved.customized).toBe(true);
    expect(resolved.subject).toBe('Custom');
    expect(resolved.body).toBe('Hello');
  });

  it('maps legacy message field to body', () => {
    const resolved = normalizeCentreEmailCustomContent(
      { message: 'Legacy intro' },
      { subject: 'Default subject', body: 'Default body' },
    );
    expect(resolved.body).toBe('Legacy intro');
    expect(resolved.customized).toBe(true);
  });

  it('allows empty custom body within max length', () => {
    expect(validateCentreEmailBody('')).toBe('');
  });
});
