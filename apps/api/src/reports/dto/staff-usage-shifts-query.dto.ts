import { IsOptional, Matches, Validate } from 'class-validator';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportPaginationQueryDto } from './report-pagination.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class StaffUsageShiftsQueryDto extends ReportPaginationQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;
}
