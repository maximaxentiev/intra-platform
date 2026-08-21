import {
  parseCentreIdsParam,
  serializeCentreIdsParam,
  hasExplicitCentreSelection,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";
import {
  parseStaffIdsParam,
  serializeStaffIdsParam,
  type StaffSelectionState,
} from "@/lib/reports-staff-selection";
import {
  REPORT_COMPARISON_DEFAULT_PAGE_SIZE,
  resolveReportComparisonPageSize,
  type ReportComparisonPageSize,
} from "@/lib/report-pagination-labels";

export const CENTRE_USAGE_SHIFT_DETAIL_STATUSES = [
  "completed",
  "pending",
  "filled",
  "cancelled",
  "all",
] as const;

export type CentreUsageShiftDetailStatus = (typeof CENTRE_USAGE_SHIFT_DETAIL_STATUSES)[number];

export const CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS: CentreUsageShiftDetailStatus = "completed";

export type CentreUsageShiftDetailSearch = {
  shiftStatus: CentreUsageShiftDetailStatus;
  shiftStaffIds: string[];
  shiftPage: number;
  shiftPageSize: ReportComparisonPageSize;
};

export { hasExplicitCentreSelection };

export function resolveCentreUsageShiftDetailStatus(
  value: string | undefined,
): CentreUsageShiftDetailStatus {
  if (value && (CENTRE_USAGE_SHIFT_DETAIL_STATUSES as readonly string[]).includes(value)) {
    return value as CentreUsageShiftDetailStatus;
  }
  return CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS;
}

export function resolveAppliedShiftDetailSearch(search: {
  shiftStatus?: string;
  shiftStaffIds?: string;
  shiftPage?: number;
  shiftPageSize?: number;
}): CentreUsageShiftDetailSearch {
  return {
    shiftStatus: resolveCentreUsageShiftDetailStatus(search.shiftStatus),
    shiftStaffIds: parseStaffIdsParam(search.shiftStaffIds),
    shiftPage: search.shiftPage && search.shiftPage > 0 ? search.shiftPage : 1,
    shiftPageSize: resolveReportComparisonPageSize(search.shiftPageSize),
  };
}

export function shiftDetailStaffSelection(staffIds: string[]): StaffSelectionState {
  if (staffIds.length === 0) {
    return { mode: "all", staffIds: [] };
  }
  return { mode: "subset", staffIds };
}

export function shiftDetailStaffIdsFromSelection(selection: StaffSelectionState): string[] {
  return selection.mode === "subset" ? selection.staffIds : [];
}

export function shiftDetailToApiQuery(
  detail: CentreUsageShiftDetailSearch,
  centreIds: string[],
): {
  centreIds: string[];
  status?: CentreUsageShiftDetailStatus;
  staffIds?: string[];
  page: number;
  pageSize: number;
} {
  return {
    centreIds,
    status: detail.shiftStatus === "completed" ? undefined : detail.shiftStatus,
    staffIds: detail.shiftStaffIds.length ? detail.shiftStaffIds : undefined,
    page: detail.shiftPage,
    pageSize: detail.shiftPageSize,
  };
}

export function shiftDetailToSearchParams(
  detail: CentreUsageShiftDetailSearch,
): {
  shiftStatus?: string;
  shiftStaffIds?: string;
  shiftPage?: number;
  shiftPageSize?: number;
} {
  return {
    shiftStatus:
      detail.shiftStatus === CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS
        ? undefined
        : detail.shiftStatus,
    shiftStaffIds: serializeStaffIdsParam(detail.shiftStaffIds),
    shiftPage: detail.shiftPage === 1 ? undefined : detail.shiftPage,
    shiftPageSize:
      detail.shiftPageSize === REPORT_COMPARISON_DEFAULT_PAGE_SIZE
        ? undefined
        : detail.shiftPageSize,
  };
}

export function defaultShiftDetailSearch(): CentreUsageShiftDetailSearch {
  return {
    shiftStatus: CENTRE_USAGE_SHIFT_DETAIL_DEFAULT_STATUS,
    shiftStaffIds: [],
    shiftPage: 1,
    shiftPageSize: REPORT_COMPARISON_DEFAULT_PAGE_SIZE,
  };
}

export function shiftDetailStatusSummaryLabel(status: CentreUsageShiftDetailStatus): string {
  switch (status) {
    case "completed":
      return "Completed Shifts";
    case "pending":
      return "Pending Shifts";
    case "filled":
      return "Filled Shifts";
    case "cancelled":
      return "Cancelled Shifts";
    default:
      return "Shifts";
  }
}

/** Re-export for tests that assert centre ID serialization in shift detail URLs. */
export { parseCentreIdsParam, serializeCentreIdsParam };
