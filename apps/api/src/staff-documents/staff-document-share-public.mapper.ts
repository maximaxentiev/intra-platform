import type { StaffDocumentFile } from '../db/schema';
import type { staff } from '../db/schema';
import type {
  PublicStaffDocumentShareDocumentDto,
  PublicStaffDocumentShareFileDto,
  PublicStaffDocumentShareMetadataDto,
} from './dto/staff-document-share-public.dto';
import type { StaffDocumentCategoryCompliance } from './staff-document-compliance.util';
import { STAFF_DOCUMENT_PUBLIC_SHARE_LABELS } from './staff-document-share-public.constants';
import { isPubliclyShareableCategory, mapPublicShareExpiryDisplay } from './staff-document-share-public-eligibility.util';
import { resolveStaffPublicDisplayName } from './staff-document-slug.util';

export function mapPublicStaffDocumentShareFile(row: StaffDocumentFile): PublicStaffDocumentShareFileDto {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    contentType: row.contentType,
  };
}

export function mapPublicStaffDocumentShareMetadata(input: {
  staff: Pick<typeof staff.$inferSelect, 'displayName' | 'useDisplayName' | 'legalName' | 'role'>;
  categories: StaffDocumentCategoryCompliance[];
  filesByType: Map<string, StaffDocumentFile[]>;
}): PublicStaffDocumentShareMetadataDto {
  const documents: PublicStaffDocumentShareDocumentDto[] = [];

  for (const category of input.categories) {
    if (!isPubliclyShareableCategory(category)) {
      continue;
    }

    const files = (input.filesByType.get(category.documentType) ?? []).map(mapPublicStaffDocumentShareFile);
    if (files.length === 0) {
      continue;
    }

    documents.push({
      documentType: category.documentType,
      label: STAFF_DOCUMENT_PUBLIC_SHARE_LABELS[category.documentType],
      processedDate: category.processedDate,
      expiryDate: category.expiryDate,
      expiryDisplay: mapPublicShareExpiryDisplay(category),
      files,
    });
  }

  return {
    staff: {
      displayName: resolveStaffPublicDisplayName(input.staff),
      role: input.staff.role,
    },
    documents,
  };
}
