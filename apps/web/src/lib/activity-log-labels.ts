import type { ActivityLogCategory } from "@/lib/reports-types";

export const ACTIVITY_LOG_DEFAULT_PAGE_SIZE = 10;

export const ACTIVITY_LOG_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type ActivityLogPageSize = (typeof ACTIVITY_LOG_PAGE_SIZE_OPTIONS)[number];

export function isActivityLogPageSize(value: number): value is ActivityLogPageSize {
  return (ACTIVITY_LOG_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function resolveActivityLogPageSize(value?: number): ActivityLogPageSize {
  if (value !== undefined && isActivityLogPageSize(value)) return value;
  return ACTIVITY_LOG_DEFAULT_PAGE_SIZE;
}

const CATEGORY_LABELS: Record<ActivityLogCategory, string> = {
  shifts: "Shifts",
  staff: "Staff",
  documents: "Documents",
  communications: "Communications",
  centres: "Centres",
  users: "Users",
  system: "System",
};

export function activityLogCategoryLabel(category: ActivityLogCategory): string {
  return CATEGORY_LABELS[category];
}

export function activityLogResultRange(input: {
  page: number;
  pageSize: number;
  totalCount: number;
}): { start: number; end: number; totalPages: number } {
  const totalPages = input.totalCount === 0 ? 0 : Math.ceil(input.totalCount / input.pageSize);
  if (input.totalCount === 0) {
    return { start: 0, end: 0, totalPages: 0 };
  }
  const start = (input.page - 1) * input.pageSize + 1;
  const end = Math.min(input.page * input.pageSize, input.totalCount);
  return { start, end, totalPages };
}
