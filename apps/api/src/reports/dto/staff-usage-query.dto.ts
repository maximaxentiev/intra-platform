import { ArrayMaxSize, IsOptional, IsUUID, Matches, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportStaffFilterQueryDto } from './report-staff-filter.dto';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class StaffUsageQueryDto extends ReportStaffFilterQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_STAFF_IDS, {
    message: `staffIds may include at most ${MAX_REPORT_STAFF_IDS} staff members.`,
  })
  staffIds?: string[];
}
