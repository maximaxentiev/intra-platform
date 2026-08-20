import { ArrayMaxSize, IsOptional, IsUUID, Matches, Validate } from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportCentreFilterQueryDto } from './report-centre-filter.dto';
import { MAX_REPORT_CENTRE_IDS, parseReportCentreIds } from './report-centre-ids.util';
import { ReportCentreScheduledHoursFiltersDto } from './report-centre-shift-metric-filters.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Centre Usage report query (supports multi-centre filtering via centreIds). */
export class CentreUsageQueryDto extends ReportCentreScheduledHoursFiltersDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;

  @IsOptional()
  @Transform(({ value }) => parseReportCentreIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_CENTRE_IDS, {
    message: `centreIds may include at most ${MAX_REPORT_CENTRE_IDS} centres.`,
  })
  centreIds?: string[];

  @IsOptional()
  @IsUUID('4')
  centreId?: string;
}
