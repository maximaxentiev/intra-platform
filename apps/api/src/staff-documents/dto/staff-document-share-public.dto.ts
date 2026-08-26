import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { StaffDocumentType } from '../staff-document.constants';

export class ExchangeStaffDocumentShareSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}

export type PublicStaffDocumentShareStaffDto = {
  legalName: string;
  role: string;
};

export type PublicStaffDocumentShareFileDto = {
  id: string;
  originalFilename: string;
  contentType: string;
};

/** Mirrors canonical backend expiry states exposed publicly (never includes expired). */
export type PublicStaffDocumentShareExpiryDisplay = 'current' | 'expiring_soon' | 'no_expiry';

export type PublicStaffDocumentShareDocumentDto = {
  documentType: StaffDocumentType;
  label: string;
  processedDate: string | null;
  expiryDate: string | null;
  expiryDisplay: PublicStaffDocumentShareExpiryDisplay;
  files: PublicStaffDocumentShareFileDto[];
};

export type PublicStaffDocumentShareMetadataDto = {
  staff: PublicStaffDocumentShareStaffDto;
  documents: PublicStaffDocumentShareDocumentDto[];
};

export type ExchangeStaffDocumentShareSessionResponseDto = {
  ok: true;
};
