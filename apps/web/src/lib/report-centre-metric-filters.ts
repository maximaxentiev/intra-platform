import {
  parseOptionalCountInput,
  parseOptionalPercentInput,
  parseHoursInputToMinutes,
} from "@/lib/report-hours-filter";

export type CentreMetricFilterSearch = {
  totalShiftsMin?: string;
  totalShiftsMax?: string;
  fillRateMin?: string;
  fillRateMax?: string;
  pendingMin?: string;
  pendingMax?: string;
  filledMin?: string;
  filledMax?: string;
  completedMin?: string;
  completedMax?: string;
  cancelledMin?: string;
  cancelledMax?: string;
  scheduledHoursMin?: string;
  scheduledHoursMax?: string;
  completedScheduledHoursMin?: string;
  completedScheduledHoursMax?: string;
};

export function centreMetricFiltersToApiQuery(filters: CentreMetricFilterSearch) {
  return {
    totalShiftsMin: parseOptionalCountInput(filters.totalShiftsMin ?? ""),
    totalShiftsMax: parseOptionalCountInput(filters.totalShiftsMax ?? ""),
    fillRateMin: parseOptionalPercentInput(filters.fillRateMin ?? ""),
    fillRateMax: parseOptionalPercentInput(filters.fillRateMax ?? ""),
    pendingMin: parseOptionalCountInput(filters.pendingMin ?? ""),
    pendingMax: parseOptionalCountInput(filters.pendingMax ?? ""),
    filledMin: parseOptionalCountInput(filters.filledMin ?? ""),
    filledMax: parseOptionalCountInput(filters.filledMax ?? ""),
    completedMin: parseOptionalCountInput(filters.completedMin ?? ""),
    completedMax: parseOptionalCountInput(filters.completedMax ?? ""),
    cancelledMin: parseOptionalCountInput(filters.cancelledMin ?? ""),
    cancelledMax: parseOptionalCountInput(filters.cancelledMax ?? ""),
    scheduledHoursMin: filters.scheduledHoursMin?.trim()
      ? Number(filters.scheduledHoursMin)
      : undefined,
    scheduledHoursMax: filters.scheduledHoursMax?.trim()
      ? Number(filters.scheduledHoursMax)
      : undefined,
    completedScheduledHoursMin: filters.completedScheduledHoursMin?.trim()
      ? Number(filters.completedScheduledHoursMin)
      : undefined,
    completedScheduledHoursMax: filters.completedScheduledHoursMax?.trim()
      ? Number(filters.completedScheduledHoursMax)
      : undefined,
  };
}

export function centreMetricFiltersToSearchParams(
  filters: CentreMetricFilterSearch,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value?.trim();
    if (trimmed) params[key] = trimmed;
  }
  return params;
}

export function parseCentreMetricFiltersFromSearch(
  rawSearch: Record<string, string | number | undefined>,
): CentreMetricFilterSearch {
  const search: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(rawSearch).map(([key, value]) => [key, typeof value === "string" ? value : undefined]),
  );
  return {
    totalShiftsMin: search.totalShiftsMin,
    totalShiftsMax: search.totalShiftsMax,
    fillRateMin: search.fillRateMin,
    fillRateMax: search.fillRateMax,
    pendingMin: search.pendingMin,
    pendingMax: search.pendingMax,
    filledMin: search.filledMin,
    filledMax: search.filledMax,
    completedMin: search.completedMin,
    completedMax: search.completedMax,
    cancelledMin: search.cancelledMin,
    cancelledMax: search.cancelledMax,
    scheduledHoursMin: search.scheduledHoursMin,
    scheduledHoursMax: search.scheduledHoursMax,
    completedScheduledHoursMin: search.completedScheduledHoursMin,
    completedScheduledHoursMax: search.completedScheduledHoursMax,
  };
}

export function buildCentreMetricFilterChips(filters: CentreMetricFilterSearch) {
  const chips: Array<{ id: string; label: string; key: keyof CentreMetricFilterSearch }> = [];

  const addRange = (
    keyMin: keyof CentreMetricFilterSearch,
    keyMax: keyof CentreMetricFilterSearch,
    label: string,
    suffix = "",
  ) => {
    const min = filters[keyMin]?.trim();
    const max = filters[keyMax]?.trim();
    if (min && max) chips.push({ id: `${keyMin}-${keyMax}`, label: `${label}: ${min}${suffix}–${max}${suffix}`, key: keyMin });
    else if (min) chips.push({ id: String(keyMin), label: `${label} ≥ ${min}${suffix}`, key: keyMin });
    else if (max) chips.push({ id: String(keyMax), label: `${label} ≤ ${max}${suffix}`, key: keyMax });
  };

  addRange("totalShiftsMin", "totalShiftsMax", "Total Shifts");
  addRange("fillRateMin", "fillRateMax", "Fill Rate", "%");
  addRange("pendingMin", "pendingMax", "Pending");
  addRange("filledMin", "filledMax", "Filled");
  addRange("completedMin", "completedMax", "Completed");
  addRange("cancelledMin", "cancelledMax", "Cancelled");
  addRange("scheduledHoursMin", "scheduledHoursMax", "Scheduled Hours", "h");
  addRange(
    "completedScheduledHoursMin",
    "completedScheduledHoursMax",
    "Completed Scheduled Hours",
    "h",
  );

  return chips;
}

export function clearCentreMetricFilterKey(
  filters: CentreMetricFilterSearch,
  key: keyof CentreMetricFilterSearch,
): CentreMetricFilterSearch {
  const next = { ...filters };
  if (key.endsWith("Min")) {
    const maxKey = key.replace("Min", "Max") as keyof CentreMetricFilterSearch;
    next[key] = "";
    next[maxKey] = "";
  } else if (key.endsWith("Max")) {
    const minKey = key.replace("Max", "Min") as keyof CentreMetricFilterSearch;
    next[minKey] = "";
    next[key] = "";
  } else {
    next[key] = "";
  }
  return next;
}

export const EMPTY_CENTRE_METRIC_FILTERS: CentreMetricFilterSearch = {
  totalShiftsMin: "",
  totalShiftsMax: "",
  fillRateMin: "",
  fillRateMax: "",
  pendingMin: "",
  pendingMax: "",
  filledMin: "",
  filledMax: "",
  completedMin: "",
  completedMax: "",
  cancelledMin: "",
  cancelledMax: "",
  scheduledHoursMin: "",
  scheduledHoursMax: "",
  completedScheduledHoursMin: "",
  completedScheduledHoursMax: "",
};
