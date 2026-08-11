import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { STAFF_DOCUMENT_TYPE_VALUES } from '../staff-document.constants';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class FlagStaffDocumentIssueDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  issueNote!: string;
}

export class SetStaffDocumentRemindersDto {
  @IsBoolean()
  enabled!: boolean;
}

/** Parsed from multipart body — not validated via class-validator pipe. */
export type StaffDocumentCategorySaveFields = {
  processedDate?: string;
  expiryDate?: string;
  retainFileIds: string[];
};

export function assertValidDocumentTypeParam(value: string): void {
  if (!(STAFF_DOCUMENT_TYPE_VALUES as readonly string[]).includes(value)) {
    throw new Error(`Invalid document type: ${value}`);
  }
}

export function validateCategoryDateFields(
  documentType: string,
  fields: { processedDate?: string; expiryDate?: string },
): void {
  if (documentType === 'vulnerable_sector_check') {
    if (!fields.processedDate || !DATE_ONLY.test(fields.processedDate)) {
      throw new Error('processedDate is required and must be YYYY-MM-DD.');
    }
    if (fields.expiryDate !== undefined && fields.expiryDate !== '') {
      throw new Error('expiryDate must not be supplied for vulnerable sector check.');
    }
    return;
  }

  if (documentType === 'first_aid_cpr') {
    if (!fields.expiryDate || !DATE_ONLY.test(fields.expiryDate)) {
      throw new Error('expiryDate is required and must be YYYY-MM-DD.');
    }
    if (fields.processedDate !== undefined && fields.processedDate !== '') {
      throw new Error('processedDate must not be supplied for first aid.');
    }
    return;
  }

  if (documentType === 'immunizations' || documentType === 'covid19_vaccination') {
    if (fields.processedDate || fields.expiryDate) {
      throw new Error('Date fields are not allowed for this document category.');
    }
  }
}
