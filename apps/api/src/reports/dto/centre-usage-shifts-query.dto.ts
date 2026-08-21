import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportPaginationQueryDto } from './report-pagination.dto';
import { parseReportCentreIds } from './report-centre-ids.util';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const CENTRE_USAGE_SHIFT_DETAIL_STATUSES = [
  'completed',
  'pending',
  'filled',
  'cancelled',
  'all',
] as const;

export type CentreUsageShiftDetailStatus = (typeof CENTRE_USAGE_SHIFT_DETAIL_STATUSES)[number];

export class CentreUsageShiftsQueryDto extends ReportPaginationQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;

  @Transform(({ value }) => parseReportCentreIds(value))
  @IsUUID('4', { each: true })
  @ArrayMinSize(1, { message: 'At least one centre ID is required.' })
  centreIds!: string[];

  @IsOptional()
  @IsIn([...CENTRE_USAGE_SHIFT_DETAIL_STATUSES])
  status?: CentreUsageShiftDetailStatus;

  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_STAFF_IDS)
  staffIds?: string[];
}
