import { IsArray, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CentreEmailCustomContentDto } from '../../email/dto/centre-email-custom-content.dto';
import { PreviewUpdateShiftDto } from '../../shifts/dto/shifts.dto';

export class ShiftCentreEmailPreviewDto {
  @IsUUID('4')
  staffId!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
}

export class ShiftCentreEmailUpdatePreviewDto extends PreviewUpdateShiftDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedChangeFields?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
}

export class BatchCentreEmailPreviewDto {
  @IsIn(['final', 'update'])
  variant!: 'final' | 'update';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedChangeIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CentreEmailCustomContentDto)
  centreEmail?: CentreEmailCustomContentDto;
}
