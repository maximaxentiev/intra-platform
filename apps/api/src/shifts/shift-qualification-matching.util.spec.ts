import { describe, expect, it } from 'vitest';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';
import {
  evaluateShiftReceEligibility,
  hasApprovedEcaDiploma,
  hasApprovedReceProof,
  shiftQualificationPreferenceRank,
} from './shift-qualification-matching.util';
import { evaluateStaffShiftEligibility, staffRolesMatchForShift } from './shift-matching.util';
import {
  buildComplianceInputsForStaff,
  deriveStaffShiftDocumentGate,
} from '../staff-documents/staff-document-compliance.util';
import type { ShiftMatchingTarget } from './shift-matching.types';

function approved(documentType: StaffDocumentCategoryComplianceInput['documentType']) {
  return {
    documentType,
    isSubmitted: true,
    reviewStatus: 'approved' as const,
    expiryDate: null,
    processedDate: null,
    fileCount: 1,
    submittedAt: '2026-01-01T00:00:00Z',
    reviewedAt: '2026-01-02T00:00:00Z',
    remindersEnabled: true,
    currentSubmissionId: 'sub-1',
    supersededAt: null,
  };
}

function shift(roleNeeded: string): ShiftMatchingTarget {
  return {
    id: 'shift-1',
    centreId: 'centre-1',
    centreCity: 'Toronto',
    shiftDate: '2026-09-15',
    startTime: '08:30:00',
    endTime: '16:30:00',
    roleNeeded,
  };
}

function eligibleEce(inputs: StaffDocumentCategoryComplianceInput[] = []) {
  return evaluateStaffShiftEligibility({
    staffId: 'staff-1',
    staffRole: 'ECE',
    account: { status: 'incomplete', onboardingCompletedAt: new Date('2026-01-01') },
    isCentreBanned: false,
    hasAvailabilityCoverage: true,
    sameDayShifts: [],
    documentGate: deriveStaffShiftDocumentGate([
      approved('vulnerable_sector_check'),
      approved('first_aid_cpr'),
      approved('immunizations'),
    ]),
    qualificationCategoryInputs: inputs,
    shift: shift('ECE'),
  });
}

describe('staffRolesMatchForShift — shift-level roles', () => {
  it('matches ECA, ECE, and RECE shift roles to the correct staff roles', () => {
    expect(staffRolesMatchForShift('ECA', 'ECA')).toBe(true);
    expect(staffRolesMatchForShift('ECE', 'ECE')).toBe(true);
    expect(staffRolesMatchForShift('RECE', 'ECE')).toBe(true);
    expect(staffRolesMatchForShift('RECE', 'ECA')).toBe(false);
    expect(staffRolesMatchForShift('ECA', 'ECE')).toBe(false);
    expect(staffRolesMatchForShift('Nanny', 'Nanny')).toBe(true);
  });
});

describe('RECE shift eligibility', () => {
  it('requires approved RECE Proof and rejects other qualification states', () => {
    expect(evaluateShiftReceEligibility({ shiftRoleNeeded: 'ECE', categoryInputs: [] }).eligible).toBe(
      true,
    );

    expect(
      evaluateShiftReceEligibility({
        shiftRoleNeeded: 'RECE',
        categoryInputs: [approved('rece_proof')],
      }).eligible,
    ).toBe(true);

    for (const inputs of [
      [],
      [approved('ece_diploma')],
      [
        {
          ...approved('rece_proof'),
          reviewStatus: 'pending_review' as const,
        },
      ],
      [
        {
          ...approved('rece_proof'),
          reviewStatus: 'issue_flagged' as const,
        },
      ],
    ]) {
      expect(
        evaluateStaffShiftEligibility({
          staffId: 'staff-1',
          staffRole: 'ECE',
          account: { status: 'incomplete', onboardingCompletedAt: new Date('2026-01-01') },
          isCentreBanned: false,
          hasAvailabilityCoverage: true,
          sameDayShifts: [],
          documentGate: deriveStaffShiftDocumentGate([
            approved('vulnerable_sector_check'),
            approved('first_aid_cpr'),
            approved('immunizations'),
          ]),
          qualificationCategoryInputs: inputs,
          shift: shift('RECE'),
        }).reasons,
      ).toContain('rece_required');
    }
  });
});

describe('ECA shift eligibility', () => {
  it('allows ECA staff without an approved diploma', () => {
    expect(
      evaluateStaffShiftEligibility({
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
        qualificationCategoryInputs: [],
        shift: shift('ECA'),
      }).eligible,
    ).toBe(true);
  });

  it('prefers approved ECA Diploma within the same tier', () => {
    expect(shiftQualificationPreferenceRank('ECA', [approved('eca_diploma')])).toBe(1);
    expect(shiftQualificationPreferenceRank('ECA', [])).toBe(0);
  });
});

describe('ECE shift eligibility and preference', () => {
  it('allows ordinary ECE and RECE staff for ECE shifts', () => {
    expect(eligibleEce([]).eligible).toBe(true);
    expect(eligibleEce([approved('rece_proof')]).eligible).toBe(true);
    expect(eligibleEce([approved('ece_diploma')]).eligible).toBe(true);
  });

  it('ranks RECE above ordinary ECE within the same tier', () => {
    expect(shiftQualificationPreferenceRank('ECE', [approved('rece_proof')])).toBe(1);
    expect(shiftQualificationPreferenceRank('ECE', [approved('ece_diploma')])).toBe(0);
    expect(shiftQualificationPreferenceRank('ECE', [])).toBe(0);
  });
});

describe('centre legacy qualification fields are ignored', () => {
  it('does not block ECA staff when legacy centre qualification would have blocked them', () => {
    const result = evaluateStaffShiftEligibility({
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
      qualificationCategoryInputs: [],
      shift: shift('ECA'),
    });

    expect(result.eligible).toBe(true);
    expect(result.reasons).not.toContain('qualification_required');
  });
});

describe('qualification document helpers', () => {
  it('detects approved submissions only from current approved files', () => {
    const inputs = buildComplianceInputsForStaff(
      [{ documentType: 'rece_proof', currentSubmissionId: 'sub-1', remindersEnabled: true }],
      new Map([
        [
          'sub-1',
          {
            id: 'sub-1',
            reviewStatus: 'approved' as const,
            expiryDate: null,
            processedDate: null,
            submittedAt: new Date('2026-01-01'),
            reviewedAt: new Date('2026-01-02'),
            supersededAt: null,
          },
        ],
      ]),
      new Map([['sub-1', 1]]),
    );

    expect(hasApprovedReceProof(inputs)).toBe(true);
    expect(hasApprovedEcaDiploma(inputs)).toBe(false);
  });
});
