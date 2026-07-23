import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

const CHANNELS = ['whatsapp', 'goto', 'email'] as const;
type Channel = (typeof CHANNELS)[number];

export class UpsertCentreDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsIn(CHANNELS)
  primaryChannel!: Channel;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
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
