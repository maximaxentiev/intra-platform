import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  MAX_REPORT_CENTRE_IDS,
  parseReportCentreIds,
  resolveCentreUsageCentreIds,
} from '../../reports/dto/report-centre-ids.util';
import { ShiftUpdateCommunicationsDto } from './shift-update.dto';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class UpsertShiftDto {
  @IsUUID('4')
  centreId!: string;

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
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  addedToStaffpoint?: boolean;
}

export class UpdateShiftDto {
  @IsOptional()
  @Matches(DATE)
  shiftDate?: string;

  @IsOptional()
  @Matches(TIME)
  startTime?: string;

  @IsOptional()
  @Matches(TIME)
  endTime?: string;

  @IsOptional()
  @IsUUID('4')
  centreId?: string;

  @IsOptional()
  @IsIn(['ECA', 'ECE', 'RECE', 'Nanny', ''])
  roleNeeded?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  addedToStaffpoint?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftUpdateCommunicationsDto)
  communications?: ShiftUpdateCommunicationsDto;

  @IsOptional()
  @IsIn(['unassign', 'availability_override'])
  assignmentResolution?: 'unassign' | 'availability_override';
}

export class PreviewUpdateShiftDto {
  @IsOptional()
  @Matches(DATE)
  shiftDate?: string;

  @IsOptional()
  @Matches(TIME)
  startTime?: string;

  @IsOptional()
  @Matches(TIME)
  endTime?: string;

  @IsOptional()
  @IsIn(['ECA', 'ECE', 'RECE', 'Nanny', ''])
  roleNeeded?: string;
}

export class ChangeStatusDto {
  @IsIn(['pending', 'filled', 'cancelled', 'completed'])
  status!: 'pending' | 'filled' | 'cancelled' | 'completed';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cancellationReason?: string;
}

export class AssignDto {
  @IsUUID('4')
  staffId!: string;
}

export class ContactedDto {
  @IsUUID('4')
  staffId!: string;
}

export class AddCommentDto {
  @IsString()
  @MaxLength(5000)
  body!: string;
}

export class ListShiftsQuery {
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
}
