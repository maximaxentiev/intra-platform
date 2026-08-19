import { IsOptional, IsUUID } from 'class-validator';

export class ReportStaffFilterQueryDto {
  @IsOptional()
  @IsUUID('4')
  staffId?: string;
}
