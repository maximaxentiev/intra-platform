import { describe, expect, it } from 'vitest';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';
import {
  evaluateCentreQualificationEligibility,
  isApprovedQualificationSubmission,
} from './staff-qualification-compliance.util';

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
    remindersEnabled: false,
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
  });
}

describe('isApprovedQualificationSubmission', () => {
  it('requires approved current submission with files', () => {
    expect(isApprovedQualificationSubmission([approved('eca_diploma')], 'eca_diploma')).toBe(true);
    expect(
      isApprovedQualificationSubmission(
        [cat('eca_diploma', { isSubmitted: true, reviewStatus: 'pending_review', fileCount: 1 })],
        'eca_diploma',
      ),
    ).toBe(false);
    expect(
      isApprovedQualificationSubmission(
        [cat('eca_diploma', { isSubmitted: true, reviewStatus: 'issue_flagged', fileCount: 1 })],
        'eca_diploma',
      ),
    ).toBe(false);
  });
});

describe('evaluateCentreQualificationEligibility', () => {
  const base = {
    centreRequiresQualification: true,
    eceQualificationRequirement: 'ece_or_rece' as const,
  };

  it('ignores qualifications when centre requirement is disabled', () => {
    expect(
      evaluateCentreQualificationEligibility({
        staffRole: 'ECA',
        centreRequiresQualification: false,
        eceQualificationRequirement: 'ece_or_rece',
        categoryInputs: [],
      }).eligible,
    ).toBe(true);
  });

  it('requires approved ECA diploma for ECA staff', () => {
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'ECA',
        categoryInputs: [approved('eca_diploma')],
      }).eligible,
    ).toBe(true);

    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'ECA',
        categoryInputs: [
          cat('eca_diploma', {
            isSubmitted: true,
            reviewStatus: 'pending_review',
            fileCount: 1,
          }),
        ],
      }),
    ).toEqual({ eligible: false, reason: 'qualification_required' });
  });

  it('accepts ECE diploma or RECE proof when ece_or_rece', () => {
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'ECE',
        categoryInputs: [approved('ece_diploma')],
      }).eligible,
    ).toBe(true);
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'ECE',
        categoryInputs: [approved('rece_proof')],
      }).eligible,
    ).toBe(true);
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'ECE',
        categoryInputs: [],
      }).eligible,
    ).toBe(false);
  });

  it('requires RECE proof only when rece_required', () => {
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        eceQualificationRequirement: 'rece_required',
        staffRole: 'ECE',
        categoryInputs: [approved('ece_diploma')],
      }),
    ).toEqual({ eligible: false, reason: 'rece_required' });

    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        eceQualificationRequirement: 'rece_required',
        staffRole: 'ECE',
        categoryInputs: [approved('rece_proof')],
      }).eligible,
    ).toBe(true);
  });

  it('does not apply to Nanny staff', () => {
    expect(
      evaluateCentreQualificationEligibility({
        ...base,
        staffRole: 'Nanny',
        categoryInputs: [],
      }).eligible,
    ).toBe(true);
  });
});
