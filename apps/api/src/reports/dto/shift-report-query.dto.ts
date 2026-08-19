import { IsOptional, Matches, Validate } from 'class-validator';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportCentreFilterQueryDto } from './report-centre-filter.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Shared query params for shift-based reports (optional dates default to Toronto current month). */
export class ShiftReportQueryDto extends ReportCentreFilterQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;
}
