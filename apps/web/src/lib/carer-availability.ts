import { api, ApiError } from "@/lib/api";

export type CarerAvailabilitySlot = {
  id: string;
  weekStartDate: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
};

export type CarerAvailabilityOnboardingState = {
  profileCompletedAt: string | null;
  documentsCompletedAt: string | null;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
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
  if (/past date/i.test(msg)) {
    return "Availability for past dates cannot be changed.";
  }
  if (/startTime must be before endTime/i.test(msg)) {
    return "End time must be after start time.";
  }
  return msg || fallback;
}

export const carerAvailabilityApi = {
  list: (weekStart: string) =>
    api.get<CarerAvailabilitySlot[]>("/staff-portal/availability", { weekStart }),

  create: (body: CreateCarerAvailabilityInput) =>
    api.post<CarerAvailabilitySlot>("/staff-portal/availability", body),

  update: (id: string, body: UpdateCarerAvailabilityInput) =>
    api.patch<CarerAvailabilitySlot>(`/staff-portal/availability/${id}`, body),

  remove: (id: string) => api.del<{ ok: true }>(`/staff-portal/availability/${id}`),

  completeStep3: () =>
    api.post<CarerAvailabilityOnboardingState>("/staff-portal/availability/complete-step-3"),
};
