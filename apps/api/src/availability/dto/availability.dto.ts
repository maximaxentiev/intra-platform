import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAvailabilityDto {
  @IsUUID('4')
  staffId!: string;

  @Matches(DATE)
  weekStartDate!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(TIME)
  startTime!: string;

  @Matches(TIME)
  endTime!: string;
}

export class UpdateAvailabilityDto {
  @IsOptional()
  @Matches(TIME)
  startTime?: string;

  @IsOptional()
  @Matches(TIME)
  endTime?: string;
}

export class ListAvailabilityQuery {
  @Matches(DATE)
  weekStart!: string;

  @IsOptional()
  @IsString()
  staffId?: string;
}
