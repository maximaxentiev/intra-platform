import { IsOptional, IsUUID } from 'class-validator';

export class ReportCentreFilterQueryDto {
  @IsOptional()
  @IsUUID('4')
  centreId?: string;
}
