import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  MAX_REPORT_CENTRE_IDS,
  parseReportCentreIds,
} from '../../reports/dto/report-centre-ids.util';
import {
  SHIFT_FEED_DEFAULT_PAGE_SIZE,
  SHIFT_FEED_PAGE_SIZE_OPTIONS,
  resolveShiftFeedPageSize,
  type ShiftFeedPageSize,
} from '../shifts-feed.util';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ShiftFeedQuery {
  @IsOptional()
  @IsUUID('4')
  centreId?: string;

  @IsOptional()
  @Transform(({ value }) => parseReportCentreIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_CENTRE_IDS, {
    message: `centreIds may include at most ${MAX_REPORT_CENTRE_IDS} centres.`,
  })
  centreIds?: string[];

  @IsOptional()
  @IsUUID('4')
  staffId?: string;

  @IsOptional()
  @IsIn(['pending', 'filled', 'cancelled', 'completed'])
  status?: string;

  @IsOptional()
  @Matches(DATE)
  from?: string;

  @IsOptional()
  @Matches(DATE)
  to?: string;

  @IsOptional()
  @IsIn(['yes', 'no'])
  staffpoint?: 'yes' | 'no';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(SHIFT_FEED_PAGE_SIZE_OPTIONS as unknown as number[])
  pageSize?: ShiftFeedPageSize;
}

export function normalizeShiftFeedQuery(q: ShiftFeedQuery) {
  return {
    centreId: q.centreId,
    centreIds: q.centreIds,
    staffId: q.staffId,
    status: q.status,
    from: q.from,
    to: q.to,
    staffpoint: q.staffpoint,
    page: q.page && q.page > 0 ? q.page : 1,
    pageSize: resolveShiftFeedPageSize(q.pageSize),
  };
}

export type ShiftFeedShiftItemDto = {
  type: 'shift';
  shift: {
    id: string;
    centreId: string;
    centreName: string | null;
    shiftDate: string;
    startTime: string;
    endTime: string;
    roleNeeded: string;
    addedToStaffpoint: boolean;
    status: string;
    assignedStaffId: string | null;
    assignedLegalName: string | null;
    assignedDisplayName: string | null;
    assignedUseDisplayName: boolean | null;
  };
};

export type ShiftFeedBatchItemDto = {
  type: 'batch';
  batch: {
    id: string;
    centreId: string;
    centreName: string;
    requestCompletedAt: string | null;
    dateRange: string | null;
    displayState:
      | 'open'
      | 'ready'
      | 'completed'
      | 'updates_required'
      | 'ready_to_send_updates';
  };
  matchingChildren: Array<{
    id: string;
    shiftDate: string;
    startTime: string;
    endTime: string;
    roleNeeded: string;
    addedToStaffpoint: boolean;
    status: string;
    assignedStaffId: string | null;
    assignedLegalName: string | null;
    assignedDisplayName: string | null;
    assignedUseDisplayName: boolean | null;
  }>;
  totalChildCount: number;
  activeChildCount: number;
  fulfilledChildCount: number;
  cancelledChildCount: number;
  matchingChildCount: number;
};

export type ShiftFeedItemDto = ShiftFeedShiftItemDto | ShiftFeedBatchItemDto;

export type ShiftFeedResponseDto = {
  items: ShiftFeedItemDto[];
  page: number;
  pageSize: typeof SHIFT_FEED_DEFAULT_PAGE_SIZE | ShiftFeedPageSize;
  totalItems: number;
  totalPages: number;
};
