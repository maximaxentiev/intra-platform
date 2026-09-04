import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CENTRE_EMAIL_CUSTOM_MESSAGE_MAX,
  CENTRE_EMAIL_CUSTOM_SUBJECT_MAX,
} from '../centre-email-custom-content.util';

export class CentreEmailCustomContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(CENTRE_EMAIL_CUSTOM_SUBJECT_MAX)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CENTRE_EMAIL_CUSTOM_MESSAGE_MAX)
  message?: string;
}
