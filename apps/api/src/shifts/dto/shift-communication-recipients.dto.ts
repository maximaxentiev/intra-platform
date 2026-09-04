import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CentreEmailCustomContentDto } from '../../email/dto/centre-email-custom-content.dto';

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
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
