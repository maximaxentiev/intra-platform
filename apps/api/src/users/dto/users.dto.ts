import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsIn(['admin', 'ops'])
  role!: 'admin' | 'ops';

  // Admin sets an initial password when provisioning the account.
  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsIn(['admin', 'ops'])
  role?: 'admin' | 'ops';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
