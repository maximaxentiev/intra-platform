import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ShiftAssignmentRecipientResult } from './shift-assignment.dto';

export class ShiftUpdateCommunicationIncludeDto {
  @IsOptional()
  @IsBoolean()
  date?: boolean;

  @IsOptional()
  @IsBoolean()
  time?: boolean;

  @IsOptional()
  @IsBoolean()
  role?: boolean;
}

export class ShiftUpdateRecipientCommunicationDto {
  @IsBoolean()
  send!: boolean;

  @ValidateNested()
  @Type(() => ShiftUpdateCommunicationIncludeDto)
  include!: ShiftUpdateCommunicationIncludeDto;
}

export class ShiftUpdateCommunicationsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftUpdateRecipientCommunicationDto)
  centre?: ShiftUpdateRecipientCommunicationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftUpdateRecipientCommunicationDto)
  carer?: ShiftUpdateRecipientCommunicationDto;
}

export type ShiftUpdateCommunicationsResult = {
  centre: ShiftAssignmentRecipientResult | null;
  carer: ShiftAssignmentRecipientResult | null;
} | null;

export type ShiftUpdateResponse = Record<string, unknown> & {
  communications: ShiftUpdateCommunicationsResult;
};
