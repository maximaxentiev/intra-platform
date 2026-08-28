import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ShiftCommunicationRecipientsDto {
  @IsOptional()
  @IsBoolean()
  centre?: boolean;

  @IsOptional()
  @IsBoolean()
  carer?: boolean;
}

export class ResendConfirmationDto {
  @ValidateNested()
  @Type(() => ShiftCommunicationRecipientsDto)
  recipients!: ShiftCommunicationRecipientsDto;
}

export class UnassignShiftDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftCommunicationRecipientsDto)
  communications?: ShiftCommunicationRecipientsDto;
}

export function resolveSelectedRecipients(input?: ShiftCommunicationRecipientsDto | null): {
  centre: boolean;
  carer: boolean;
} {
  return {
    centre: input?.centre === true,
    carer: input?.carer === true,
  };
}
