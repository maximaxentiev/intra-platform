import { describe, expect, it } from 'vitest';
import {
  buildShiftCancellationCentreEmailContent,
  centreCancellationEmailContainsNoSensitiveInternals,
} from './shift-cancellation-centre-email.template';

describe('buildShiftCancellationCentreEmailContent', () => {
  const base = {
    centreName: 'Sunrise Child Care',
    carerLegalName: 'Jane Carer',
    roleNeeded: 'RECE',
    shiftDate: '2026-09-10',
    startTime: '09:00:00',
    endTime: '17:00:00',
  };

  it('includes cancelled wording and shift details', () => {
    const content = buildShiftCancellationCentreEmailContent(base);
    expect(content.subject).toContain('Shift cancelled');
    expect(content.text).toContain('Shift cancelled');
    expect(content.text).toContain('Sunrise Child Care');
    expect(content.text).toContain('Jane Carer');
    expect(content.text).toContain('RECE');
  });

  it('excludes cancellation reason and internal fields', () => {
    const content = buildShiftCancellationCentreEmailContent({
      ...base,
      carerLegalName: 'Jane Carer',
    });
    expect(content.text).not.toContain('Family emergency');
    expect(centreCancellationEmailContainsNoSensitiveInternals(content)).toBe(true);
  });

  it('escapes HTML in dynamic values', () => {
    const content = buildShiftCancellationCentreEmailContent({
      ...base,
      centreName: 'Care <script>',
    });
    expect(content.html).toContain('Care &lt;script&gt;');
  });

  it('uses legal full name for centre-facing carer label', () => {
    const content = buildShiftCancellationCentreEmailContent({
      ...base,
      carerLegalName: 'Jaspreet Singh',
    });
    expect(content.text).toContain('Jaspreet Singh');
    expect(content.text).not.toContain('Jaz');
  });
});
