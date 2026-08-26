import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportDateRangeQueryDto } from './report-date-range.dto';
import {
  ACTIVITY_LOG_ACTOR_TYPES,
  ACTIVITY_LOG_CATEGORIES,
  type ActivityLogActorType,
  type ActivityLogCategory,
} from '../types/activity-log.types';
import { REPORT_MAX_PAGE_SIZE } from '../report-pagination.util';

export class ActivityLogQueryDto extends ReportDateRangeQueryDto {
  @IsOptional()
  @IsIn([...ACTIVITY_LOG_CATEGORIES])
  category?: ActivityLogCategory;

  @IsOptional()
  @IsIn([...ACTIVITY_LOG_ACTOR_TYPES])
  actorType?: ActivityLogActorType;

  @IsOptional()
  @IsUUID('4')
  staffId?: string;

  @IsOptional()
  @IsUUID('4')
  centreId?: string;

  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

  /** Filter to activity performed by a specific Ops user (matches `actor_user_id`). */
  @IsOptional()
  @IsUUID('4')
  opsUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_MAX_PAGE_SIZE)
  pageSize?: number;
}
