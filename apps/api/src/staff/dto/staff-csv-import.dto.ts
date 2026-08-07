import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class StaffCsvImportConfirmDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  sendPortalInvitations?: boolean;
}
