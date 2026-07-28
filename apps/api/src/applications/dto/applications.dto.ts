import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const APPLICATION_ROLES = ['eca', 'ece_rece', 'nanny'] as const;
const APPLICATION_STATUSES = ['new', 'contacted', 'hired', 'rejected'] as const;

export type ApplicationRoleFilter = (typeof APPLICATION_ROLES)[number];
export type ApplicationStatusFilter = (typeof APPLICATION_STATUSES)[number];

export class ListApplicationsQuery {
  @IsOptional()
  @IsIn(APPLICATION_ROLES)
  role?: ApplicationRoleFilter;

  @IsOptional()
  @IsIn(APPLICATION_STATUSES)
  status?: ApplicationStatusFilter;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export { APPLICATION_ROLES, APPLICATION_STATUSES };
