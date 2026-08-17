import { Type } from 'class-transformer';
import { IsInt, IsIn, IsOptional, Matches, Max, Min } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ListStaffPortalAvailabilityQuery {
  @Matches(DATE, { message: 'weekStart must be a valid YYYY-MM-DD date.' })
  weekStart!: string;
}

export const UPCOMING_AVAILABILITY_PAGE_SIZES = [10, 25, 50] as const;
export type UpcomingAvailabilityPageSize = (typeof UPCOMING_AVAILABILITY_PAGE_SIZES)[number];

export class ListUpcomingStaffPortalAvailabilityQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn(UPCOMING_AVAILABILITY_PAGE_SIZES)
  pageSize: UpcomingAvailabilityPageSize = 10;
}

export type StaffPortalUpcomingAvailabilityWindowDto = {
  id: string;
  startTime: string;
  endTime: string;
};

export type StaffPortalUpcomingAvailabilityDateDto = {
  calendarDate: string;
  windows: StaffPortalUpcomingAvailabilityWindowDto[];
};

export type StaffPortalUpcomingAvailabilityResponseDto = {
  items: StaffPortalUpcomingAvailabilityDateDto[];
  page: number;
  pageSize: UpcomingAvailabilityPageSize;
  totalDates: number;
  totalPages: number;
};

export class CreateStaffPortalAvailabilityDto {
  @Matches(DATE, { message: 'weekStartDate must be a valid YYYY-MM-DD date.' })
  weekStartDate!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(TIME_HM, { message: 'startTime must be a valid HH:mm time.' })
  startTime!: string;

  @Matches(TIME_HM, { message: 'endTime must be a valid HH:mm time.' })
  endTime!: string;
}

export class UpdateStaffPortalAvailabilityDto {
  @Matches(TIME_HM, { message: 'startTime must be a valid HH:mm time.' })
  startTime!: string;

  @Matches(TIME_HM, { message: 'endTime must be a valid HH:mm time.' })
  endTime!: string;
}

export class MarkStaffPortalUnavailableDto {
  @Matches(DATE, { message: 'weekStartDate must be a valid YYYY-MM-DD date.' })
  weekStartDate!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;
}

export type StaffPortalAvailabilityDto = {
  id: string;
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
};

export type StaffPortalAvailabilityOnboardingDto = {
  profileCompletedAt: string | null;
  documentsCompletedAt: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
};

export type OnboardingDayStatus = 'exempt_past' | 'incomplete' | 'available' | 'unavailable';

export type StaffPortalAvailabilityOnboardingDayDto = {
  calendarDate: string;
  weekIndex: 1 | 2;
  dayOfWeek: number;
  status: OnboardingDayStatus;
  windows: StaffPortalAvailabilityDto[];
};

export type StaffPortalAvailabilityOnboardingStateDto = {
  anchorEstablished: boolean;
  week1Start: string | null;
  week2Start: string | null;
  days: StaffPortalAvailabilityOnboardingDayDto[];
  /** @deprecated Informational only; does not gate availability-step completion. */
  week1Complete: boolean;
  /** @deprecated Informational only; does not gate availability-step completion. */
  week2Complete: boolean;
  /** @deprecated Informational only; does not gate availability-step or final onboarding completion. */
  canCompleteOnboarding: boolean;
};
