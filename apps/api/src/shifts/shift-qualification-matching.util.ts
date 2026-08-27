import { normalizeShiftRole } from '@intra/shared';
import {
  type QualificationStaffDocumentType,
} from '../staff-documents/staff-document.constants';
import type { StaffDocumentCategoryComplianceInput } from '../staff-documents/staff-document-compliance.util';

export type ShiftQualificationEligibilityReason = 'rece_required';

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

export function hasApprovedReceProof(
  inputs: readonly StaffDocumentCategoryComplianceInput[],
): boolean {
  return isApprovedQualificationSubmission(inputs, 'rece_proof');
}

export function hasApprovedEcaDiploma(
  inputs: readonly StaffDocumentCategoryComplianceInput[],
): boolean {
  return isApprovedQualificationSubmission(inputs, 'eca_diploma');
}

/**
 * RECE Shifts require Ops-approved RECE Proof.
 * ECA and ECE Shifts never hard-gate on qualification documents.
 */
export function evaluateShiftReceEligibility(input: {
  shiftRoleNeeded: string;
  categoryInputs: readonly StaffDocumentCategoryComplianceInput[];
}): { eligible: boolean; reason: ShiftQualificationEligibilityReason | null } {
  if (normalizeShiftRole(input.shiftRoleNeeded) !== 'RECE') {
    return { eligible: true, reason: null };
  }

  if (hasApprovedReceProof(input.categoryInputs)) {
    return { eligible: true, reason: null };
  }

  return { eligible: false, reason: 'rece_required' };
}

/**
 * Qualification preference rank within a Top + geographic tier.
 * Higher values sort earlier.
 */
export function shiftQualificationPreferenceRank(
  shiftRoleNeeded: string,
  categoryInputs: readonly StaffDocumentCategoryComplianceInput[],
): number {
  const shiftRole = normalizeShiftRole(shiftRoleNeeded);

  if (shiftRole === 'ECA') {
    return hasApprovedEcaDiploma(categoryInputs) ? 1 : 0;
  }

  if (shiftRole === 'ECE') {
    return hasApprovedReceProof(categoryInputs) ? 1 : 0;
  }

  return 0;
}
