import { api, ApiError } from "@/lib/api";

export type CarerAvailabilitySlot = {
  id: string;
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
};

export type CarerOnboardingStatus = {
  profileComplete: boolean;
  profileCompletedAt: string | null;
  documentsComplete: boolean;
  documentsCompletedAt: string | null;
  availabilityComplete: boolean;
  availabilityCompletedAt: string | null;
  onboardingComplete: boolean;
  onboardingCompletedAt: string | null;
  canCompleteOnboarding: boolean;
  onboardingStep: number;
};

export type OnboardingDayStatus = "exempt_past" | "incomplete" | "available" | "unavailable";

export type CarerOnboardingAvailabilityDay = {
  calendarDate: string;
  weekIndex: 1 | 2;
  dayOfWeek: number;
  status: OnboardingDayStatus;
  windows: CarerAvailabilitySlot[];
};

export type CarerGuidedAvailabilityOnboardingState = {
  anchorEstablished: boolean;
  week1Start: string | null;
  week2Start: string | null;
  days: CarerOnboardingAvailabilityDay[];
  week1Complete: boolean;
  week2Complete: boolean;
  canCompleteOnboarding: boolean;
};

export type CreateCarerAvailabilityInput = {
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type UpdateCarerAvailabilityInput = {
  startTime: string;
  endTime: string;
};

export type MarkCarerUnavailableInput = {
  weekStartDate: string;
  dayOfWeek: number;
};

export type UpcomingAvailabilityPageSize = 10 | 25 | 50;

export type CarerUpcomingAvailabilityWindow = {
  id: string;
  startTime: string;
  endTime: string;
};

export type CarerUpcomingAvailabilityDate = {
  calendarDate: string;
  windows: CarerUpcomingAvailabilityWindow[];
};

export type CarerUpcomingAvailabilityResponse = {
  items: CarerUpcomingAvailabilityDate[];
  page: number;
  pageSize: UpcomingAvailabilityPageSize;
  totalDates: number;
  totalPages: number;
};

export const CARER_AVAILABILITY_ONBOARDING_STATE_QUERY_KEY = [
  "carer-availability-onboarding-state",
] as const;

export function validateClientTimeRange(startTime: string, endTime: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return "Enter valid start and end times.";
  }
  if (startTime >= endTime) {
    return "End time must be after start time.";
  }
  return null;
}

export function sortAvailabilitySlots(slots: CarerAvailabilitySlot[]): CarerAvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.startTime.localeCompare(b.startTime);
  });
}

export function groupSlotsByDay(
  slots: CarerAvailabilitySlot[],
): Map<number, CarerAvailabilitySlot[]> {
  const grouped = new Map<number, CarerAvailabilitySlot[]>();
  for (const slot of sortAvailabilitySlots(slots)) {
    const list = grouped.get(slot.dayOfWeek) ?? [];
    list.push(slot);
    grouped.set(slot.dayOfWeek, list);
  }
  return grouped;
}

export function countOnboardingWeekProgress(
  days: CarerOnboardingAvailabilityDay[],
  weekIndex: 1 | 2,
): { answered: number; required: number } {
  const weekDays = days.filter((d) => d.weekIndex === weekIndex);
  const required = weekDays.filter((d) => d.status !== "exempt_past");
  const answered = required.filter(
    (d) => d.status === "available" || d.status === "unavailable",
  );
  return { answered: answered.length, required: required.length };
}

export function defaultOnboardingWizardWeek(_state?: CarerGuidedAvailabilityOnboardingState): 1 | 2 {
  return 1;
}

export function mapAvailabilityApiError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) {
    return err instanceof Error ? err.message : fallback;
  }
  if (err.status === 401) return "Your session expired. Sign in again to continue.";
  if (err.status === 404) return "That availability record could not be found.";
  const msg = err.message;
  if (/overlap/i.test(msg)) {
    return "This time overlaps with availability you've already added.";
  }
  if (/identical/i.test(msg)) {
    return "This time range matches availability you've already added.";
  }
  if (/past date/i.test(msg) || /Past dates cannot/i.test(msg)) {
    return "Availability for past dates cannot be changed.";
  }
  if (/startTime must be before endTime/i.test(msg)) {
    return "End time must be after start time.";
  }
  if (/Complete availability for every required day/i.test(msg)) {
    return "Could not complete your availability step. Try again.";
  }
  if (/availability step/i.test(msg)) {
    return msg;
  }
  if (/outside your guided onboarding period/i.test(msg)) {
    return "That date is outside your guided onboarding period.";
  }
  if (/onboarding period/i.test(msg)) {
    return "Set up your two-week availability period before continuing.";
  }
  if (/Establish your onboarding period/i.test(msg)) {
    return "Your availability onboarding period could not be loaded. Try again.";
  }
  if (/Could not establish onboarding anchor/i.test(msg)) {
    return "Could not start your availability onboarding. Try again.";
  }
  return msg || fallback;
}

export const carerAvailabilityApi = {
  list: (weekStart: string) =>
    api.get<CarerAvailabilitySlot[]>("/staff-portal/availability", { weekStart }),

  listUpcoming: (params: { page: number; pageSize: UpcomingAvailabilityPageSize }) =>
    api.get<CarerUpcomingAvailabilityResponse>("/staff-portal/availability/upcoming", params),

  create: (body: CreateCarerAvailabilityInput) =>
    api.post<CarerAvailabilitySlot>("/staff-portal/availability", body),

  update: (id: string, body: UpdateCarerAvailabilityInput) =>
    api.patch<CarerAvailabilitySlot>(`/staff-portal/availability/${id}`, body),

  remove: (id: string) => api.del<{ ok: true }>(`/staff-portal/availability/${id}`),

  ensureOnboardingState: () =>
    api.post<CarerGuidedAvailabilityOnboardingState>(
      "/staff-portal/availability/onboarding-state/ensure",
    ),

  getOnboardingState: () =>
    api.get<CarerGuidedAvailabilityOnboardingState>(
      "/staff-portal/availability/onboarding-state",
    ),

  markUnavailable: (body: MarkCarerUnavailableInput) =>
    api.post<CarerGuidedAvailabilityOnboardingState>(
      "/staff-portal/availability/mark-unavailable",
      body,
    ),

  clearUnavailable: (body: MarkCarerUnavailableInput) =>
    api.del<CarerGuidedAvailabilityOnboardingState>(
      "/staff-portal/availability/mark-unavailable",
      body,
    ),

  completeOnboardingStep: () =>
    api.post<CarerOnboardingStatus>("/staff-portal/availability/complete-onboarding-step"),
};
