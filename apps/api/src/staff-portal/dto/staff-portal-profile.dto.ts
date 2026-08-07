import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Carer self-service personal information (Step 1 / future profile screen). */
export class PatchStaffPortalProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalFirstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  legalLastName!: string;

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
