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
const TRI_STATE = ['yes', 'no', 'any', 'missing'] as const;
const COVID_FILTER = ['yes', 'no', 'any', 'not_provided'] as const;
const DOC_PRESENCE = ['yes', 'no', 'any'] as const;
const SORT_BY = ['submittedAt', 'createdAt', 'applicant', 'email', 'status', 'reviewedAt'] as const;
const SORT_DIR = ['asc', 'desc'] as const;
const ARRAY_MATCH = ['any', 'all'] as const;

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

  @IsOptional()
  @IsIn(['yes', 'no', 'any'])
  reviewed?: 'yes' | 'no' | 'any';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  intakeVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  preferredName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  statusInCanada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  experienceDuration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  qualificationStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  englishProficiency?: string;

  @IsOptional()
  @IsIn(TRI_STATE)
  gtaEligible?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  trainingCompleted?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  hasChildcareExperience?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  accuracyConfirmed?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  consentAccepted?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  vscYesNo?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  firstAidYesNo?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(TRI_STATE)
  immunizationYesNo?: (typeof TRI_STATE)[number];

  @IsOptional()
  @IsIn(COVID_FILTER)
  covid?: (typeof COVID_FILTER)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  vscStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  firstAidStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  experienceTypes?: string;

  @IsOptional()
  @IsIn(ARRAY_MATCH)
  experienceTypesMatch?: (typeof ARRAY_MATCH)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ageGroups?: string;

  @IsOptional()
  @IsIn(ARRAY_MATCH)
  ageGroupsMatch?: (typeof ARRAY_MATCH)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  specialExperienceTypes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  educationCertifications?: string;

  @IsOptional()
  @IsIn(ARRAY_MATCH)
  educationCertificationsMatch?: (typeof ARRAY_MATCH)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  languages?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  legallyAuthorizedToWork?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workPermitChildcareRestrictions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorizedOffCampus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  workHourLimitStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  educationProgramName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(168)
  maxWeeklyHoursMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(168)
  maxWeeklyHoursMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  spokenEnglishMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  spokenEnglishMax?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  submittedFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  submittedTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  createdFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  createdTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vscDateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  vscDateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  firstAidExpiryFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  firstAidExpiryTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  workPermitExpiryFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  workPermitExpiryTo?: string;

  @IsOptional()
  @IsIn(DOC_PRESENCE)
  hasResume?: (typeof DOC_PRESENCE)[number];

  @IsOptional()
  @IsIn(DOC_PRESENCE)
  hasVscDocument?: (typeof DOC_PRESENCE)[number];

  @IsOptional()
  @IsIn(SORT_BY)
  sortBy?: (typeof SORT_BY)[number];

  @IsOptional()
  @IsIn(SORT_DIR)
  sortDir?: (typeof SORT_DIR)[number];
}

export { APPLICATION_ROLES, APPLICATION_STATUSES };
