import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ReportCitiesFilterQueryDto } from './report-cities-filter.dto';

/** Shared shift-count metric filters for centre comparison reports. */
export class ReportCentreShiftMetricFiltersDto extends ReportCitiesFilterQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalShiftsMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  totalShiftsMax?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  fillRateMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(100)
  fillRateMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  pendingMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  filledMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  filledMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cancelledMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cancelledMax?: number;
}

/** Centre Usage adds scheduled-hours filters (UI hours → stored as minutes internally). */
export class ReportCentreScheduledHoursFiltersDto extends ReportCentreShiftMetricFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  scheduledHoursMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  scheduledHoursMax?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  completedScheduledHoursMin?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  completedScheduledHoursMax?: number;
}
