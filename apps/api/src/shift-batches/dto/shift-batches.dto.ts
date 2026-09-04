import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CentreEmailCustomContentDto } from '../../email/dto/centre-email-custom-content.dto';
import { ShiftCommunicationRecipientsDto } from '../../shifts/dto/shift-communication-recipients.dto';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateShiftBatchDto {
  @IsUUID('4')
  centreId!: string;
}

export class CreateBatchChildShiftDto {
  @Matches(DATE)
  shiftDate!: string;

  @Matches(TIME)
  startTime!: string;

  @Matches(TIME)
  endTime!: string;

  @IsOptional()
  @IsIn(['ECA', 'ECE', 'RECE', ''])
  roleNeeded?: string;

  @IsOptional()
  @IsBoolean()
  addedToStaffpoint?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  confirmationNotes?: string;

  /** Optional initial Ops-only internal comment — not external Shift Notes. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  internalComment?: string;
}

export class BulkCreateBatchChildShiftsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateBatchChildShiftDto)
  shifts!: CreateBatchChildShiftDto[];
}

export type ShiftBatchChildSummaryDto = {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  roleNeeded: string;
  addedToStaffpoint: boolean;
  status: string;
  confirmationNotes: string | null;
  assignedStaffId: string | null;
  assignedLegalName: string | null;
  assignedDisplayName: string | null;
  assignedUseDisplayName: boolean | null;
};

export type BatchProgressEmailStatusDto =
  | { state: 'none' }
  | { state: 'scheduled'; scheduledAt: string }
  | { state: 'sending' }
  | { state: 'sent'; sentAt: string }
  | { state: 'failed'; reason: string; canRetry: true }
  | { state: 'blocked'; reason: string; canRetry: true };

export type BatchFinalConfirmationStatusDto =
  | { state: 'none' }
  | { state: 'scheduled'; scheduledAt: string }
  | { state: 'sending' }
  | { state: 'sent'; sentAt: string }
  | { state: 'failed'; reason: string; canRetry: true };

export type BatchCompletionReadinessDto = {
  ready: boolean;
  primaryContactEmail: string | null;
  activeShiftCount: number;
  fulfilledShiftCount: number;
  blockers: Array<{
    code: string;
    message: string;
    shiftId?: string;
    shiftDate?: string;
    startTime?: string;
    endTime?: string;
    carerName?: string | null;
    carerStaffId?: string | null;
  }>;
};

export type ShiftBatchWorkspaceDto = {
  id: string;
  centreId: string;
  centreName: string;
  requestCompletedAt: string | null;
  requestCompletedByUserId: string | null;
  confirmationRevision: number;
  pendingChangeRevision: number;
  lastConfirmationScheduledAt: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  cancellationReason: string | null;
  confirmationUiState:
    | 'open'
    | 'ready'
    | 'completed'
    | 'updates_required'
    | 'ready_to_send_updates'
    | 'cancelled';
  progressEmailScheduledAt: string | null;
  progressEmailStatus: BatchProgressEmailStatusDto;
  finalConfirmationStatus: BatchFinalConfirmationStatusDto;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  shifts: ShiftBatchChildSummaryDto[];
};

export type BulkCreateBatchChildShiftsResultDto = {
  created: { id: string; shiftDate: string }[];
};

export class CreateBatchWithShiftsDto {
  @IsUUID('4')
  centreId!: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateBatchChildShiftDto)
  shifts!: CreateBatchChildShiftDto[];
}

export type CreateBatchWithShiftsResultDto = {
  batch: {
    id: string;
    centreId: string;
    createdByUserId: string | null;
    requestCompletedAt: string | null;
    requestCompletedByUserId: string | null;
    createdAt: string;
    updatedAt: string;
  };
  created: { id: string; shiftDate: string }[];
};

export class CancelShiftBatchDto {
  @IsString()
  cancellationReason!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftCommunicationRecipientsDto)
  communications?: ShiftCommunicationRecipientsDto;
}

export class CompleteBatchRequestDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
}

export class SendBatchUpdatesConfirmationDto {
  @IsArray()
  @IsString({ each: true })
  selectedChangeIds!: string[];

  @IsOptional()
  @IsInt()
  expectedPendingChangeRevision?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
}
