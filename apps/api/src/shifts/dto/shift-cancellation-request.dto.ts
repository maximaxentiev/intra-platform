import { Transform, Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateShiftCancellationRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Reason is required.' })
  @MaxLength(1000)
  reason!: string;
}

export class ResolveShiftCancellationRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;
}

export class ListPendingCancellationRequestsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([10, 25, 50])
  pageSize?: 10 | 25 | 50 = 25;
}

export type CarerCancellationRequestDto = {
  id: string;
  shiftId: string;
  status: 'pending' | 'resolved';
  reason: string;
  requestedAt: string;
};

export type CarerCancellationRequestSummaryDto = {
  status: 'pending';
  requestedAt: string;
};

export type OpsCancellationRequestDto = {
  id: string;
  shiftId: string;
  staffId: string;
  staffLegalName: string;
  staffDisplayName: string;
  staffUseDisplayName: boolean;
  status: 'pending' | 'resolved';
  reason: string;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolutionNote: string;
};

export type PendingCancellationRequestListItemDto = {
  requestId: string;
  shiftId: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  centreName: string;
  staffLegalName: string;
  staffDisplayName: string;
  staffUseDisplayName: boolean;
  reason: string;
  requestedAt: string;
};
