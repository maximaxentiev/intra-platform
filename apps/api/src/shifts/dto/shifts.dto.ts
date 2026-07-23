import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

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
  @IsIn(['ECA', 'ECE', ''])
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
  @IsIn(['ECA', 'ECE', ''])
  roleNeeded?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  addedToStaffpoint?: boolean;
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
