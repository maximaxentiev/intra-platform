import type { SearchSchemaInput } from "@tanstack/react-router";

/** Map legacy Shift Fulfillment search params onto Centre Usage. */
export function mapShiftFulfillmentSearchToCentreUsage(
  search: SearchSchemaInput,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  if (typeof search.dateFrom === "string" && search.dateFrom) {
    next.dateFrom = search.dateFrom;
  }
  if (typeof search.dateTo === "string" && search.dateTo) {
    next.dateTo = search.dateTo;
  }
  if (typeof search.centreIds === "string" && search.centreIds) {
    next.centreIds = search.centreIds;
  }
  if (typeof search.centreId === "string" && search.centreId) {
    next.centreId = search.centreId;
  }
  if (typeof search.page === "number" && search.page > 1) {
    next.page = search.page;
  }
  if (typeof search.pageSize === "number" && search.pageSize) {
    next.pageSize = search.pageSize;
  }

  const metricKeys = [
    "totalShiftsMin",
    "totalShiftsMax",
    "fillRateMin",
    "fillRateMax",
    "pendingMin",
    "pendingMax",
    "filledMin",
    "filledMax",
    "completedMin",
    "completedMax",
    "cancelledMin",
    "cancelledMax",
  ] as const;

  for (const key of metricKeys) {
    const value = search[key];
    if (typeof value === "string" && value) {
      next[key] = value;
    }
  }

  return next;
}
