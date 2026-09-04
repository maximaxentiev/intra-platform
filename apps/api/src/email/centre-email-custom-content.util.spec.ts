import { describe, expect, it } from 'vitest';
import {
  normalizeCentreEmailCustomContent,
  renderCentreEmailCustomMessageHtml,
  validateCentreEmailMessage,
  validateCentreEmailSubject,
} from './centre-email-custom-content.util';
import { buildShiftAssignmentCentreEmailContent } from '../shifts/shift-assignment-centre-email.template';

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
      customMessage: baseline.defaultMessage,
    });
    expect(withDefaults.subject).toBe(baseline.subject);
    expect(withDefaults.text).toBe(baseline.text);
    expect(withDefaults.html).toBe(baseline.html);
  });

  it('applies custom subject and message', () => {
    const content = buildShiftAssignmentCentreEmailContent({
      centreName: 'Sunrise Centre',
      carerLegalName: 'Jaspreet Singh',
      roleNeeded: null,
      shiftDate: '2026-09-05',
      startTime: '09:00:00',
      endTime: '17:00:00',
      shiftConfirmationNotes: '',
      documentShareUrl: 'https://example.test/share/abc',
      customSubject: 'Updated staffing confirmation for Friday',
      customMessage: 'Thanks for speaking with us today. Please see the confirmed staffing details below.',
    });
    expect(content.subject).toBe('Updated staffing confirmation for Friday');
    expect(content.text).toContain('Thanks for speaking with us today.');
    expect(content.html).toContain('Thanks for speaking with us today.');
  });

  it('normalizes custom content against defaults', () => {
    const resolved = normalizeCentreEmailCustomContent(
      { subject: 'Custom', message: 'Hello' },
      { subject: 'Default subject', message: '' },
    );
    expect(resolved.customized).toBe(true);
    expect(resolved.subject).toBe('Custom');
    expect(resolved.message).toBe('Hello');
  });

  it('allows empty custom message within max length', () => {
    expect(validateCentreEmailMessage('')).toBe('');
  });
});
