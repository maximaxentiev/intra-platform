import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export class OpsOverrideActualHoursDto {
  @Matches(TIME)
  actualStartTime!: string;

  @Matches(TIME)
  actualEndTime!: string;

  @IsString()
  @MaxLength(2000)
  note!: string;

  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}
