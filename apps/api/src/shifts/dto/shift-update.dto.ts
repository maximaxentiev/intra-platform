import { IsBoolean, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { ShiftAssignmentRecipientResult } from './shift-assignment.dto';
import type { AssigneeImpactPreview, AssigneeImpactStatus } from '../shift-update-assignee-impact.util';
import type { ShiftCommunicationChange } from '../shift-update-changes.util';

export class ShiftUpdateCommunicationIncludeDto {
  @IsOptional()
  @IsBoolean()
  date?: boolean;

  @IsOptional()
  @IsBoolean()
  time?: boolean;

  @IsOptional()
  @IsBoolean()
  role?: boolean;

  @IsOptional()
  @IsBoolean()
  shiftNotes?: boolean;
}

export class ShiftUpdateRecipientCommunicationDto {
  @IsBoolean()
  send!: boolean;

  @ValidateNested()
  @Type(() => ShiftUpdateCommunicationIncludeDto)
  include!: ShiftUpdateCommunicationIncludeDto;
}

export class ShiftUpdateCommunicationsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftUpdateRecipientCommunicationDto)
  centre?: ShiftUpdateRecipientCommunicationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftUpdateRecipientCommunicationDto)
  carer?: ShiftUpdateRecipientCommunicationDto;
}

export type ShiftUpdateCommunicationsResult = {
  centre: ShiftAssignmentRecipientResult | null;
  carer: ShiftAssignmentRecipientResult | null;
} | null;

export type ShiftAssignmentImpactAction = 'unchanged' | 'unassigned' | 'availability_override';

export type ShiftUpdateAssignmentImpactResult = {
  action: ShiftAssignmentImpactAction;
  previousStaffId?: string | null;
};

export type ShiftUpdateResponse = Record<string, unknown> & {
  communications: ShiftUpdateCommunicationsResult;
  assignmentImpact: ShiftUpdateAssignmentImpactResult;
};

export type ShiftUpdatePreviewResponse = {
  relevantChanges: ShiftCommunicationChange[];
  assigneeImpact: AssigneeImpactPreview | null;
  requiresAssignmentResolution: boolean;
};
