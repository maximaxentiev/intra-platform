import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, Max, Min } from 'class-validator';

export const STAFF_PORTAL_SHIFT_PAGE_SIZES = [10, 25] as const;
export type StaffPortalShiftPageSize = (typeof STAFF_PORTAL_SHIFT_PAGE_SIZES)[number];

export class ListStaffPortalShiftsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(STAFF_PORTAL_SHIFT_PAGE_SIZES)
  pageSize: StaffPortalShiftPageSize = 10;
}

export class ListStaffPortalShiftHistoryQuery extends ListStaffPortalShiftsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(STAFF_PORTAL_SHIFT_PAGE_SIZES)
  pageSize: StaffPortalShiftPageSize = 25;
}

export class StaffPortalShiftsSummaryQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  limit: number = 3;
}

export type CarerShiftStatus = 'upcoming' | 'today' | 'completed' | 'cancelled';

export type CarerShiftSummaryDto = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string | null;
  status: CarerShiftStatus;
  centre: {
    name: string;
    address: string;
    city: string;
  };
  /** Present on detail/cancel responses when the shift is cancelled. */
  cancellationReason?: string | null;
};

export type StaffPortalShiftsPageResponseDto = {
  items: CarerShiftSummaryDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type StaffPortalShiftsSummaryResponseDto = {
  items: CarerShiftSummaryDto[];
};
