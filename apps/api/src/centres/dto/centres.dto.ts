import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const CHANNELS = ['whatsapp', 'goto', 'email'] as const;
type Channel = (typeof CHANNELS)[number];

const ECE_QUALIFICATION_REQUIREMENTS = ['ece_or_rece', 'rece_required'] as const;
export type CentreEceQualificationRequirementDto = (typeof ECE_QUALIFICATION_REQUIREMENTS)[number];

export class UpsertCentreDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  city?: string;

  // Agreed hourly charge for this centre, e.g. "28.50".
  @IsOptional()
  @IsNumberString()
  hourlyRate?: string;

  @IsIn(CHANNELS)
  primaryChannel!: Channel;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalOpsNotes?: string | null;

  @IsOptional()
  @IsBoolean()
  requiresQualificationForMatching?: boolean;

  @IsOptional()
  @IsIn(ECE_QUALIFICATION_REQUIREMENTS)
  eceQualificationRequirement?: CentreEceQualificationRequirementDto;
}

export class SetSecondaryChannelsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(CHANNELS, { each: true })
  channels!: Channel[];
}

export class UpsertContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;
}

export class ReorderContactsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class SetStaffLinksDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  staffIds!: string[];
}
