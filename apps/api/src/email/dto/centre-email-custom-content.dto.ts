import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  CENTRE_EMAIL_CUSTOM_BODY_MAX,
  CENTRE_EMAIL_CUSTOM_SUBJECT_MAX,
} from '../centre-email-custom-content.util';

export class CentreEmailCustomContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(CENTRE_EMAIL_CUSTOM_SUBJECT_MAX)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CENTRE_EMAIL_CUSTOM_BODY_MAX)
  body?: string;

  /** @deprecated Legacy intro-only field. */
  @IsOptional()
  @IsString()
  @MaxLength(CENTRE_EMAIL_CUSTOM_BODY_MAX)
  message?: string;
}
