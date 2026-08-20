import { ArrayMaxSize, IsIn, IsOptional, IsUUID, Matches, Validate } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { STAFF_CANONICAL_ROLES } from '../../staff/staff-role.util';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { ReportStaffFilterQueryDto } from './report-staff-filter.dto';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';
import { ReportPaginationQueryDto } from './report-pagination.dto';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STAFF_STATUS_VALUES = ['active', 'inactive'] as const;

export class StaffUsageQueryDto extends ReportPaginationQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsIn([...STAFF_CANONICAL_ROLES], { each: true })
  roles?: string[];

  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsIn([...STAFF_STATUS_VALUES], { each: true })
  staffStatuses?: string[];

  @IsOptional()
  @Type(() => Number)
  completedShiftsMin?: number;

  @IsOptional()
  @Type(() => Number)
  completedShiftsMax?: number;

  @IsOptional()
  @Type(() => Number)
  completedScheduledHoursMin?: number;

  @IsOptional()
  @Type(() => Number)
  completedScheduledHoursMax?: number;

  @IsOptional()
  @Type(() => Number)
  filledShiftsMin?: number;

  @IsOptional()
  @Type(() => Number)
  filledShiftsMax?: number;

  @IsOptional()
  @Type(() => Number)
  filledScheduledHoursMin?: number;

  @IsOptional()
  @Type(() => Number)
  filledScheduledHoursMax?: number;

  @IsOptional()
  @IsUUID('4')
  staffId?: string;
}

export { STAFF_STATUS_VALUES };
