import type { StaffDocumentType } from './staff-document.constants';
import type { StaffDocumentCategoryCompliance } from './staff-document-compliance.util';
import { isStaffDocumentPublicShareType } from './staff-document.constants';

/** True when a current submission may appear on the public share page. */
export function isPubliclyShareableCategory(category: StaffDocumentCategoryCompliance): boolean {
  if (!isStaffDocumentPublicShareType(category.documentType)) {
    return false;
  }

  if (
    !category.isSubmitted ||
    category.reviewStatus !== 'approved' ||
    category.supersededAt !== null ||
    category.fileCount === 0
  ) {
    return false;
  }

  if (category.expiryDisplay === 'expired') {
    return false;
  }

  return true;
}

export function mapPublicShareExpiryDisplay(
  category: StaffDocumentCategoryCompliance,
): 'current' | 'expiring_soon' | 'no_expiry' {
  if (category.expiryDisplay === 'expiring_soon') {
    return 'expiring_soon';
  }
  if (category.expiryDisplay === 'no_expiry') {
    return 'no_expiry';
  }
  return 'current';
}

export type PublicStaffDocumentShareType = StaffDocumentType;
