import { describe, expect, it } from 'vitest';
import {
  buildComplianceInputsForStaff,
  deriveStaffShiftDocumentGate,
  type StaffDocumentCategoryComplianceInput,
} from '../staff-documents/staff-document-compliance.util';
import type { SameDayStaffShift, ShiftMatchingTarget } from './shift-matching.types';
import {
  addHoursToTimeString,
  availabilityWindowCoversShift,
  evaluateStaffShiftEligibility,
  shiftsTimeOverlap,
  staffRolesMatchForShift,
  violatesPriorShiftBuffer,
} from './shift-matching.util';

const SHIFT: ShiftMatchingTarget = {
  id: 'target-shift',
  centreId: 'centre-1',
  centreCity: 'Toronto',
  shiftDate: '2026-09-15',
  startTime: '08:30:00',
  endTime: '16:30:00',
  roleNeeded: 'ECA',
};

function defaultQualificationInputs(): StaffDocumentCategoryComplianceInput[] {
  return [];
}

function eligibleBase(overrides: Partial<Parameters<typeof evaluateStaffShiftEligibility>[0]> = {}) {
  return evaluateStaffShiftEligibility({
    staffId: 'staff-1',
    staffRole: 'ECA',
    account: { status: 'incomplete', onboardingCompletedAt: new Date('2026-01-01') },
    isCentreBanned: false,
    hasAvailabilityCoverage: true,
    sameDayShifts: [],
    documentGate: deriveStaffShiftDocumentGate([
      approved('vulnerable_sector_check'),
      approved('first_aid_cpr'),
      approved('immunizations'),
    ]),
    qualificationCategoryInputs: defaultQualificationInputs(),
    shift: SHIFT,
    ...overrides,
  });
}
function cat(
  documentType: StaffDocumentCategoryComplianceInput['documentType'],
  overrides: Partial<StaffDocumentCategoryComplianceInput> = {},
): StaffDocumentCategoryComplianceInput {
  return {
    documentType,
    isSubmitted: false,
    reviewStatus: 'not_submitted',
    expiryDate: null,
    processedDate: null,
    fileCount: 0,
    submittedAt: null,
    reviewedAt: null,
    remindersEnabled: true,
    currentSubmissionId: null,
    supersededAt: null,
    ...overrides,
  };
}

function approved(documentType: StaffDocumentCategoryComplianceInput['documentType']) {
  return cat(documentType, {
    isSubmitted: true,
    reviewStatus: 'approved',
    fileCount: 1,
    currentSubmissionId: 'sub-1',
    submittedAt: '2026-01-01T00:00:00Z',
    reviewedAt: '2026-01-02T00:00:00Z',
  });
}

describe('availabilityWindowCoversShift', () => {
  it('accepts exact and wider windows', () => {
    expect(availabilityWindowCoversShift('08:30:00', '16:30:00', '08:30:00', '16:30:00')).toBe(true);
    expect(availabilityWindowCoversShift('08:00:00', '17:00:00', '08:30:00', '16:30:00')).toBe(true);
  });

  it('rejects windows starting too late or ending too early', () => {
    expect(availabilityWindowCoversShift('09:00:00', '17:00:00', '08:30:00', '16:30:00')).toBe(false);
    expect(availabilityWindowCoversShift('08:00:00', '16:00:00', '08:30:00', '16:30:00')).toBe(false);
  });
});

describe('shiftsTimeOverlap', () => {
  it('detects overlap and allows adjacent shifts', () => {
    expect(shiftsTimeOverlap('09:00:00', '12:00:00', '11:00:00', '15:00:00')).toBe(true);
    expect(shiftsTimeOverlap('09:00:00', '12:00:00', '12:00:00', '15:00:00')).toBe(false);
  });
});

describe('violatesPriorShiftBuffer', () => {
  it('blocks less than 2 hours and allows exactly 2 hours', () => {
    expect(violatesPriorShiftBuffer('13:00:00', '14:59:00')).toBe(true);
    expect(violatesPriorShiftBuffer('13:00:00', '15:00:00')).toBe(false);
    expect(violatesPriorShiftBuffer('13:00:00', '15:01:00')).toBe(false);
  });

  it('adds two hours correctly', () => {
    expect(addHoursToTimeString('13:00:00', 2)).toBe('15:00:00');
  });
});

describe('staffRolesMatchForShift', () => {
  it('matches when role required and equal', () => {
    expect(staffRolesMatchForShift('ECA', 'ECA')).toBe(true);
    expect(staffRolesMatchForShift(' ECA ', 'ECA')).toBe(true);
  });

  it('allows any staff when shift role blank', () => {
    expect(staffRolesMatchForShift('', 'Nanny')).toBe(true);
  });

  it('rejects mismatch', () => {
    expect(staffRolesMatchForShift('ECE', 'ECA')).toBe(false);
  });
});

describe('evaluateStaffShiftEligibility — availability', () => {
  it('requires availability coverage', () => {
    const result = eligibleBase({ hasAvailabilityCoverage: false });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('not_available');
  });
});

describe('evaluateStaffShiftEligibility — overlap', () => {
  it('blocks filled overlapping shifts', () => {
    const other: SameDayStaffShift = {
      id: 'other-1',
      assignedStaffId: 'staff-1',
      startTime: '10:00:00',
      endTime: '14:00:00',
      status: 'filled',
    };
    const result = eligibleBase({ sameDayShifts: [other] });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('shift_overlap');
  });

  it('ignores cancelled assigned shifts', () => {
    const cancelled: SameDayStaffShift = {
      id: 'cancelled-1',
      assignedStaffId: 'staff-1',
      startTime: '09:00:00',
      endTime: '17:00:00',
      status: 'cancelled',
    };
    const result = eligibleBase({ sameDayShifts: [cancelled] });
    expect(result.reasons).not.toContain('shift_overlap');
    expect(result.reasons).not.toContain('prior_shift_buffer');
    expect(result.eligible).toBe(true);
  });

  it('allows adjacent non-overlapping shifts without buffer violation', () => {
    const prior: SameDayStaffShift = {
      id: 'prior-1',
      assignedStaffId: 'staff-1',
      startTime: '09:00:00',
      endTime: '12:00:00',
      status: 'filled',
    };
    const result = eligibleBase({
      shift: { ...SHIFT, startTime: '14:00:00', endTime: '18:00:00' },
      sameDayShifts: [prior],
    });
    expect(result.eligible).toBe(true);
  });
});

describe('evaluateStaffShiftEligibility — buffer', () => {
  it('blocks when prior completed shift ends less than 2 hours before target', () => {
    const prior: SameDayStaffShift = {
      id: 'prior-completed',
      assignedStaffId: 'staff-1',
      startTime: '09:00:00',
      endTime: '13:00:00',
      status: 'completed',
    };
    const result = eligibleBase({
      shift: { ...SHIFT, startTime: '14:00:00', endTime: '18:00:00' },
      sameDayShifts: [prior],
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('prior_shift_buffer');
  });

  it('allows exactly 2-hour gap after completed shift', () => {
    const prior: SameDayStaffShift = {
      id: 'prior-completed',
      assignedStaffId: 'staff-1',
      startTime: '09:00:00',
      endTime: '13:00:00',
      status: 'completed',
    };
    const result = eligibleBase({
      shift: { ...SHIFT, startTime: '15:00:00', endTime: '18:00:00' },
      sameDayShifts: [prior],
    });
    expect(result.eligible).toBe(true);
  });
});

describe('evaluateStaffShiftEligibility — account', () => {
  it('requires an onboarded portal account and never uses inactive_staff', () => {
    expect(eligibleBase().eligible).toBe(true);
    expect(eligibleBase().reasons).not.toContain('inactive_staff');
    expect(eligibleBase({ account: null }).reasons).toContain('no_portal_account');
    expect(
      eligibleBase({ account: { status: 'disabled', onboardingCompletedAt: new Date() } }).reasons,
    ).toContain('account_disabled');
    expect(
      eligibleBase({ account: { status: 'incomplete', onboardingCompletedAt: null } }).reasons,
    ).toContain('onboarding_incomplete');
  });
});

describe('evaluateStaffShiftEligibility — documents', () => {
  it('requires all required categories approved/current', () => {
    const gate = deriveStaffShiftDocumentGate([
      approved('vulnerable_sector_check'),
      approved('first_aid_cpr'),
      approved('immunizations'),
    ]);
    expect(eligibleBase({ documentGate: gate }).eligible).toBe(true);
  });

  it('rejects missing, pending, issue flagged, and expired required documents', () => {
    for (const gate of [
      deriveStaffShiftDocumentGate([]),
      deriveStaffShiftDocumentGate([
        cat('vulnerable_sector_check', {
          isSubmitted: true,
          reviewStatus: 'pending_review',
          fileCount: 1,
          currentSubmissionId: 'x',
        }),
      ]),
      deriveStaffShiftDocumentGate([
        cat('first_aid_cpr', {
          isSubmitted: true,
          reviewStatus: 'issue_flagged',
          fileCount: 1,
          currentSubmissionId: 'x',
        }),
      ]),
      deriveStaffShiftDocumentGate([
        approved('vulnerable_sector_check'),
        approved('first_aid_cpr'),
        cat('immunizations', {
          isSubmitted: true,
          reviewStatus: 'approved',
          fileCount: 1,
          currentSubmissionId: 'x',
          expiryDate: '2020-01-01',
        }),
      ]),
    ]) {
      expect(eligibleBase({ documentGate: gate }).reasons).toContain('documents_ineligible');
    }
  });

  it('allows expiring soon and optional missing COVID', () => {
    const gate = deriveStaffShiftDocumentGate([
      approved('vulnerable_sector_check'),
      approved('first_aid_cpr'),
      cat('immunizations', {
        isSubmitted: true,
        reviewStatus: 'approved',
        fileCount: 1,
        currentSubmissionId: 'x',
        expiryDate: '2026-09-01',
      }),
    ]);
    expect(eligibleBase({ documentGate: gate }).eligible).toBe(true);
  });

  it('treats pending replacement as ineligible even with prior approved history', () => {
    const inputs = buildComplianceInputsForStaff(
      [
        {
          documentType: 'vulnerable_sector_check',
          currentSubmissionId: 'new-sub',
          remindersEnabled: true,
        },
      ],
      new Map([
        [
          'new-sub',
          {
            id: 'new-sub',
            reviewStatus: 'pending_review' as const,
            expiryDate: null,
            processedDate: null,
            submittedAt: new Date('2026-08-01'),
            reviewedAt: null,
            supersededAt: null,
          },
        ],
      ]),
      new Map([['new-sub', 1]]),
    );
    expect(eligibleBase({ documentGate: deriveStaffShiftDocumentGate(inputs) }).eligible).toBe(
      false,
    );
  });
});

describe('evaluateStaffShiftEligibility — ban and role', () => {
  it('rejects centre-banned staff', () => {
    expect(eligibleBase({ isCentreBanned: true }).reasons).toContain('centre_banned');
  });

  it('rejects role mismatch when shift specifies role', () => {
    expect(eligibleBase({ staffRole: 'ECE' }).reasons).toContain('role_mismatch');
  });

  it('allows ECE staff for RECE shifts before document gate', () => {
    expect(
      staffRolesMatchForShift('RECE', 'ECE'),
    ).toBe(true);
  });
});

describe('evaluateStaffShiftEligibility — combinations', () => {
  it('returns multiple reasons deterministically', () => {
    const result = eligibleBase({
      hasAvailabilityCoverage: false,
      isCentreBanned: true,
      documentGate: deriveStaffShiftDocumentGate([]),
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining(['not_available', 'centre_banned', 'documents_ineligible']),
    );
  });
});

describe('evaluateStaffShiftEligibility — shift qualification requirements', () => {
  it('allows ECA staff without approved diploma on ECA shifts', () => {
    expect(
      eligibleBase({
        staffRole: 'ECA',
        shift: { ...SHIFT, roleNeeded: 'ECA' },
        qualificationCategoryInputs: [],
      }).eligible,
    ).toBe(true);
  });

  it('blocks ECE staff without approved RECE proof on RECE shifts', () => {
    expect(
      eligibleBase({
        staffRole: 'ECE',
        shift: { ...SHIFT, roleNeeded: 'RECE' },
        qualificationCategoryInputs: [],
      }).reasons,
    ).toContain('rece_required');
  });

  it('allows ECE staff with approved RECE proof on RECE shifts', () => {
    expect(
      eligibleBase({
        staffRole: 'ECE',
        shift: { ...SHIFT, roleNeeded: 'RECE' },
        qualificationCategoryInputs: [approved('rece_proof')],
      }).eligible,
    ).toBe(true);
  });

  it('does not require ECE diploma for ordinary ECE on ECE shifts', () => {
    expect(
      eligibleBase({
        staffRole: 'ECE',
        shift: { ...SHIFT, roleNeeded: 'ECE' },
        qualificationCategoryInputs: [],
      }).eligible,
    ).toBe(true);
  });
});
