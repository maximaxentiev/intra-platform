import type { StaffDocumentCategoryCompliance } from './staff-document-compliance.util';
import { isStaffDocumentPublicShareType } from './staff-document.constants';

/** True when a current submission may appear on the public share page. */
export function isPubliclyShareableCategory(category: StaffDocumentCategoryCompliance): boolean {
  return (
    isStaffDocumentPublicShareType(category.documentType) &&
    category.isSubmitted &&
    category.reviewStatus === 'approved' &&
    category.supersededAt === null &&
    category.fileCount > 0 &&
    category.expiryDisplay !== 'expired'
  );
}
