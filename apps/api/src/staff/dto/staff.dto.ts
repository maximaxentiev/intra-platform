import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpsertStaffDto {
  @IsString()
  @MaxLength(200)
  legalName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  legalFirstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  legalLastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  @IsOptional()
  @IsBoolean()
  useDisplayName?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsIn(['ECA', 'ECE', 'Nanny', ''])
  role?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  // Sanitized server-side to http(s) only.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  documentsUrl?: string;
}

export class SetCentreLinksDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  centreIds!: string[];
}
