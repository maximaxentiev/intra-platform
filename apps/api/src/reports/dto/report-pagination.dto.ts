import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  REPORT_DEFAULT_PAGE,
  REPORT_DEFAULT_PAGE_SIZE,
  REPORT_MAX_PAGE_SIZE,
} from '../report-pagination.util';

export class ReportPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = REPORT_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_MAX_PAGE_SIZE)
  pageSize?: number = REPORT_DEFAULT_PAGE_SIZE;
}
