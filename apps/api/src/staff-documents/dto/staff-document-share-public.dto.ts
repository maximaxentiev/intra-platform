import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
  displayName: string;
  role: string;
};

export type PublicStaffDocumentShareFileDto = {
  id: string;
  originalFilename: string;
  contentType: string;
};

export type PublicStaffDocumentShareDocumentDto = {
  documentType: 'vulnerable_sector_check' | 'first_aid_cpr';
  label: string;
  processedDate: string | null;
  expiryDate: string | null;
  expiryDisplay: 'current' | 'expiring_soon';
  files: PublicStaffDocumentShareFileDto[];
};

export type PublicStaffDocumentShareMetadataDto = {
  staff: PublicStaffDocumentShareStaffDto;
  documents: PublicStaffDocumentShareDocumentDto[];
};

export type ExchangeStaffDocumentShareSessionResponseDto = {
  ok: true;
};
