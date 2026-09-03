import { describe, expect, it } from 'vitest';
import { formatCarerNameForReport, formatStaffReportName } from './report-staff-name.util';

const baseStaff = {
  legalFirstName: 'Alexandra',
  legalLastName: 'Morgan',
  legalName: 'Alexandra Morgan',
  displayName: 'Alex',
  useDisplayName: true,
};

describe('formatStaffReportName', () => {
  it('uses display name for Ops when useDisplayName is true', () => {
    expect(formatStaffReportName(baseStaff)).toBe('Alex');
  });
});

describe('formatCarerNameForReport', () => {
  it('uses display name for Ops audience', () => {
    expect(formatCarerNameForReport(baseStaff, 'ops')).toBe('Alex');
  });

  it('uses legal full name for Centre audience', () => {
    expect(formatCarerNameForReport(baseStaff, 'centre')).toBe('Alexandra Morgan');
    expect(formatCarerNameForReport(baseStaff, 'centre')).not.toBe('Alex');
  });

  it('uses legal first only when last name missing', () => {
    expect(
      formatCarerNameForReport(
        { ...baseStaff, legalLastName: '', legalName: 'Alexandra Morgan' },
        'centre',
      ),
    ).toBe('Alexandra');
  });

  it('uses legal last only when first name missing', () => {
    expect(
      formatCarerNameForReport(
        { ...baseStaff, legalFirstName: '', legalName: 'Alexandra Morgan' },
        'centre',
      ),
    ).toBe('Morgan');
  });

  it('falls back to legalName when first and last are empty', () => {
    expect(
      formatCarerNameForReport(
        {
          ...baseStaff,
          legalFirstName: '',
          legalLastName: '',
          legalName: 'Legacy Legal',
        },
        'centre',
      ),
    ).toBe('Legacy Legal');
  });

  it('falls back to display name only when no legal components exist', () => {
    expect(
      formatCarerNameForReport(
        {
          legalFirstName: '',
          legalLastName: '',
          legalName: '',
          displayName: 'Alex',
          useDisplayName: true,
        },
        'centre',
      ),
    ).toBe('Alex');
  });

  it('returns em dash when no name data exists', () => {
    expect(
      formatCarerNameForReport(
        {
          legalFirstName: '',
          legalLastName: '',
          legalName: '',
          displayName: '',
          useDisplayName: false,
        },
        'centre',
      ),
    ).toBe('—');
  });

  it('never returns undefined/null artifacts', () => {
    for (const audience of ['ops', 'centre'] as const) {
      const name = formatCarerNameForReport(baseStaff, audience);
      expect(name).not.toMatch(/undefined|null/i);
      expect(name.trim()).toBe(name);
    }
  });
});
