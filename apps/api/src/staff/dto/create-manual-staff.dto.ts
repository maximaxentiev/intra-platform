import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { STAFF_CANONICAL_ROLES } from '../staff-role.util';

/** Phase 1A — ops manual staff creation (no portal account until invite). */
export class CreateManualStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalFirstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalLastName!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([...STAFF_CANONICAL_ROLES])
  role!: (typeof STAFF_CANONICAL_ROLES)[number];

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  city!: string;
}

import { IsBoolean, IsOptional } from 'class-validator';

export class PortalInvitationRequestDto {
  @IsOptional()
  @IsBoolean()
  resend?: boolean;
}
