import { ReportCitiesFilterQueryDto } from './report-cities-filter.dto';
import { ReportPaginationQueryDto } from './report-pagination.dto';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
  Validate,
} from 'class-validator';
import { ReportDateRangeConstraint } from './report-date-range.dto';
import { parseReportCentreIds } from './report-centre-ids.util';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';
import { normalizeReportCitiesList, parseReportCities } from './report-cities.util';
import { ReportSupportedCitiesConstraint } from './report-cities-filter.dto';
import { SUPPORTED_CITIES } from '@intra/shared';
import { MAX_REPORT_CITIES } from './report-cities.util';

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
  @Transform(({ value }) => normalizeReportCitiesList(parseReportCities(value)))
  @Validate(ReportSupportedCitiesConstraint)
  @IsIn(SUPPORTED_CITIES as unknown as string[], { each: true })
  @ArrayMaxSize(MAX_REPORT_CITIES, {
    message: `cities may include at most ${MAX_REPORT_CITIES} cities.`,
  })
  cities?: ReportCitiesFilterQueryDto['cities'];

  @IsOptional()
  @IsIn([...CENTRE_USAGE_SHIFT_DETAIL_STATUSES])
  status?: CentreUsageShiftDetailStatus;

  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_STAFF_IDS)
  staffIds?: string[];
}
