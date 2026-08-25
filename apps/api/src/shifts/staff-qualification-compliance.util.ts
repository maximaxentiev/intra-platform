import {
  type QualificationStaffDocumentType,
  qualificationTypesForStaffRole,
} from '../staff-documents/staff-document.constants';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';

export type CentreEceQualificationRequirement = 'ece_or_rece' | 'rece_required';

export type ShiftQualificationEligibilityReason = 'qualification_required' | 'rece_required';

function normalizeStaffRole(role: string | null | undefined): string | null {
  const trimmed = (role ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isApprovedQualificationSubmission(
  inputs: readonly StaffDocumentCategoryComplianceInput[],
  documentType: QualificationStaffDocumentType,
): boolean {
  const category = inputs.find((row) => row.documentType === documentType);
  return Boolean(
    category?.isSubmitted &&
      category.reviewStatus === 'approved' &&
      category.fileCount > 0 &&
      category.supersededAt == null,
  );
}

/**
 * Centre-specific qualification gate for shift matching.
 * When disabled, qualifications are ignored entirely. Nanny staff are always exempt.
 */
export function evaluateCentreQualificationEligibility(input: {
  staffRole: string;
  centreRequiresQualification: boolean;
  eceQualificationRequirement: CentreEceQualificationRequirement;
  categoryInputs: readonly StaffDocumentCategoryComplianceInput[];
}): { eligible: boolean; reason: ShiftQualificationEligibilityReason | null } {
  if (!input.centreRequiresQualification) {
    return { eligible: true, reason: null };
  }

  const role = normalizeStaffRole(input.staffRole);
  if (role === 'Nanny') {
    return { eligible: true, reason: null };
  }

  if (role === 'ECA') {
    if (isApprovedQualificationSubmission(input.categoryInputs, 'eca_diploma')) {
      return { eligible: true, reason: null };
    }
    return { eligible: false, reason: 'qualification_required' };
  }

  if (role === 'ECE') {
    if (input.eceQualificationRequirement === 'rece_required') {
      if (isApprovedQualificationSubmission(input.categoryInputs, 'rece_proof')) {
        return { eligible: true, reason: null };
      }
      return { eligible: false, reason: 'rece_required' };
    }

    if (
      isApprovedQualificationSubmission(input.categoryInputs, 'ece_diploma') ||
      isApprovedQualificationSubmission(input.categoryInputs, 'rece_proof')
    ) {
      return { eligible: true, reason: null };
    }
    return { eligible: false, reason: 'qualification_required' };
  }

  const expectedTypes = qualificationTypesForStaffRole(role);
  if (expectedTypes.length === 0) {
    return { eligible: true, reason: null };
  }

  const hasApproved = expectedTypes.some((type) =>
    isApprovedQualificationSubmission(input.categoryInputs, type),
  );
  if (hasApproved) {
    return { eligible: true, reason: null };
  }

  return {
    eligible: false,
    reason:
      input.eceQualificationRequirement === 'rece_required' && role === 'ECE'
        ? 'rece_required'
        : 'qualification_required',
  };
}
