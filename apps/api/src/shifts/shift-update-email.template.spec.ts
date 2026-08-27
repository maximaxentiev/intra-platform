import { describe, expect, it } from 'vitest';
import { buildShiftUpdateCarerEmailContent } from './shift-update-carer-email.template';
import { buildShiftUpdateCentreEmailContent } from './shift-update-centre-email.template';
import { buildShiftUpdateUnassignCarerEmailContent } from './shift-update-unassign-carer-email.template';
import { buildShiftUpdateUnassignCentreEmailContent } from './shift-update-unassign-centre-email.template';
import type { ShiftCommunicationChange } from './shift-update-changes.util';

const dateChange: ShiftCommunicationChange = {
  field: 'date',
  label: 'Date',
  beforeDisplay: 'Friday, August 28, 2026',
  afterDisplay: 'Saturday, August 29, 2026',
  beforeValue: '2026-08-28',
  afterValue: '2026-08-29',
};

const timeChange: ShiftCommunicationChange = {
  field: 'time',
  label: 'Time',
  beforeDisplay: '8:00 AM – 4:00 PM',
  afterDisplay: '9:00 AM – 5:00 PM',
  beforeValue: '08:00:00|16:00:00',
  afterValue: '09:00:00|17:00:00',
};

describe('shift update email templates', () => {
  it('centre email includes only selected changes', () => {
    const content = buildShiftUpdateCentreEmailContent({
      centreName: 'Sunshine Centre',
      carerLegalName: 'Jane Doe',
      includedChanges: [dateChange],
    });
    expect(content.text).toContain('Date');
    expect(content.text).toContain('August 28, 2026');
    expect(content.text).not.toContain('9:00 AM');
    expect(content.text).toContain('Jane Doe');
  });

  it('carer email excludes deselected time change', () => {
    const content = buildShiftUpdateCarerEmailContent({
      centreName: 'Sunshine Centre',
      includedChanges: [dateChange],
    });
    expect(content.text).toContain('Date');
    expect(content.text).not.toContain('9:00 AM');
    expect(content.text).not.toContain('Role required');
  });

  it('centre email includes date and time when both selected', () => {
    const content = buildShiftUpdateCentreEmailContent({
      centreName: 'Sunshine Centre',
      carerLegalName: null,
      includedChanges: [dateChange, timeChange],
    });
    expect(content.text).toContain('August 29, 2026');
    expect(content.text).toContain('9:00 AM');
  });

  it('centre unassign email includes replacement wording without availability details', () => {
    const content = buildShiftUpdateUnassignCentreEmailContent({
      centreName: 'Sunshine Centre',
      includedChanges: [dateChange, timeChange],
    });
    expect(content.text).toContain('previously assigned educator is no longer assigned');
    expect(content.text).toContain('August 29, 2026');
    expect(content.text).not.toContain('availability');
  });

  it('carer unassign email includes only selected changes and unassignment wording', () => {
    const content = buildShiftUpdateUnassignCarerEmailContent({
      centreName: 'Sunshine Centre',
      includedChanges: [dateChange],
    });
    expect(content.text).toContain('no longer assigned');
    expect(content.text).toContain('August 29, 2026');
    expect(content.text).not.toContain('9:00 AM');
  });
});
