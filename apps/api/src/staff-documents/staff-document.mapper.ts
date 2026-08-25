import type { StaffDocumentFile } from '../db/schema';
import {
  isRequiredStaffDocumentType,
  isStaffDocumentReminderType,
  STAFF_DOCUMENT_TYPE_VALUES,
  type StaffDocumentType,
} from './staff-document.constants';
import type { StaffDocumentCategoryCompliance } from './staff-document-compliance.util';
import type { StaffShiftDocumentGate } from './staff-document-compliance.util';

export type StaffDocumentFileDto = {
  id: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  createdAt: string;
};

export type StaffDocumentCategoryDto = {
  documentType: StaffDocumentType;
  required: boolean;
  isSubmitted: boolean;
  reviewStatus: string;
  processedDate: string | null;
  expiryDate: string | null;
  expiryDisplay: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  issueNote: string | null;
  remindersEnabled: boolean;
  currentSubmissionId: string | null;
  files: StaffDocumentFileDto[];
};

export type StaffDocumentsListDto = {
  staffRole: string;
  categories: StaffDocumentCategoryDto[];
  documentsCompletedAt: string | null;
  onboardingStep: number;
  canCompleteStep2: boolean;
  documentStatus: string;
  shiftEligible: boolean;
  shiftEligibilityReasons: string[];
};

export type StaffDocumentsOpsListDto = StaffDocumentsListDto & {
  staffId: string;
};

export function mapStaffDocumentFile(row: StaffDocumentFile): StaffDocumentFileDto {
  return {
    id: row.id,
    originalFilename: row.originalFilename,
    contentType: row.contentType,
    byteSize: row.byteSize,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapStaffDocumentCategory(
  compliance: StaffDocumentCategoryCompliance,
  files: StaffDocumentFileDto[],
): StaffDocumentCategoryDto {
  return {
    documentType: compliance.documentType,
    required: isRequiredStaffDocumentType(compliance.documentType),
    isSubmitted: compliance.isSubmitted,
    reviewStatus: compliance.reviewStatus,
    processedDate: compliance.processedDate,
    expiryDate: compliance.expiryDate,
    expiryDisplay: compliance.expiryDisplay,
    submittedAt: compliance.submittedAt,
    reviewedAt: compliance.reviewedAt,
    issueNote:
      compliance.reviewStatus === 'issue_flagged' && compliance.isSubmitted
        ? null // filled by service from submission row
        : null,
    remindersEnabled: isStaffDocumentReminderType(compliance.documentType)
      ? compliance.remindersEnabled
      : false,
    currentSubmissionId: compliance.currentSubmissionId,
    files,
  };
}

export function buildDocumentsListDto(input: {
  staffRole: string;
  categories: StaffDocumentCategoryCompliance[];
  filesByType: Map<StaffDocumentType, StaffDocumentFileDto[]>;
  issueNotesByType: Map<StaffDocumentType, string>;
  documentsCompletedAt: Date | null;
  onboardingStep: number;
  canCompleteStep2: boolean;
  gate: StaffShiftDocumentGate;
}): StaffDocumentsListDto {
  const categories = STAFF_DOCUMENT_TYPE_VALUES.map((type) => {
    const compliance = input.categories.find((c) => c.documentType === type);
    if (!compliance) {
      throw new Error(`Missing compliance for ${type}`);
    }
    const dto = mapStaffDocumentCategory(
      compliance,
      input.filesByType.get(type) ?? [],
    );
    if (compliance.reviewStatus === 'issue_flagged') {
      dto.issueNote = input.issueNotesByType.get(type) ?? '';
    } else {
      dto.issueNote = null;
    }
    return dto;
  });

  return {
    staffRole: input.staffRole,
    categories,
    documentsCompletedAt: input.documentsCompletedAt?.toISOString() ?? null,
    onboardingStep: input.onboardingStep,
    canCompleteStep2: input.canCompleteStep2,
    documentStatus: input.gate.documentStatus,
    shiftEligible: input.gate.eligible,
    shiftEligibilityReasons: input.gate.reasons,
  };
}
