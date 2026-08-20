import { formatDocumentDate } from "@/lib/carer-documents";
import {
  DOCUMENT_OVERALL_STATUS_LABELS,
  DOCUMENT_REPORT_STATUS_LABELS,
  DOCUMENT_TYPE_FILTER_OPTIONS,
  documentReportStatusLabel,
  type DocumentOverallComplianceStatus,
  type DocumentReportStatus,
} from "@/lib/reports-document-labels";

export const STAFF_ROLE_FILTER_OPTIONS = ["ECA", "ECE", "Nanny"] as const;

export const STAFF_STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export const OVERALL_COMPLIANCE_FILTER_OPTIONS = [
  { value: "compliant", label: DOCUMENT_OVERALL_STATUS_LABELS.compliant },
  { value: "expiring_soon", label: DOCUMENT_OVERALL_STATUS_LABELS.expiring_soon },
  { value: "needs_attention", label: DOCUMENT_OVERALL_STATUS_LABELS.needs_attention },
] as const;

export const VSC_STATUS_FILTER_OPTIONS = [
  "not_submitted",
  "pending_review",
  "approved",
  "expiring_soon",
  "expired",
  "issue_flagged",
] as const satisfies readonly DocumentReportStatus[];

export const FIRST_AID_STATUS_FILTER_OPTIONS = [...VSC_STATUS_FILTER_OPTIONS] as const;

/** Immunizations do not use expiry-oriented statuses in this report model. */
export const IMMUNIZATIONS_STATUS_FILTER_OPTIONS = [
  "not_submitted",
  "pending_review",
  "approved",
  "issue_flagged",
] as const satisfies readonly DocumentReportStatus[];

export const COVID_STATUS_FILTER_OPTIONS = [
  "not_submitted",
  "pending_review",
  "approved",
  "expiring_soon",
  "expired",
  "issue_flagged",
] as const satisfies readonly DocumentReportStatus[];

export const REMINDER_STATUS_FILTER_OPTIONS = [
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "scheduled", label: "Scheduled" },
  { value: "none", label: "None" },
] as const;

export const UPCOMING_REMINDER_FILTER_OPTIONS = [
  { value: "has", label: "Has upcoming reminder" },
  { value: "none", label: "No upcoming reminder" },
] as const;

export type DocumentComplianceFilterState = {
  overallCompliance: DocumentOverallComplianceStatus[];
  documentType: string;
  roles: string[];
  staffStatuses: string[];
  vscStatuses: DocumentReportStatus[];
  firstAidStatuses: DocumentReportStatus[];
  immunizationsStatuses: DocumentReportStatus[];
  covidStatuses: DocumentReportStatus[];
  vscRenewalDueFrom: string;
  vscRenewalDueTo: string;
  firstAidExpiryFrom: string;
  firstAidExpiryTo: string;
  vscReminderStatuses: string[];
  firstAidReminderStatuses: string[];
  upcomingReminder: string;
  /** Legacy any-document status from bookmarked URLs (status without per-doc mapping). */
  legacyStatus: string;
};

export const EMPTY_DOCUMENT_COMPLIANCE_FILTERS: DocumentComplianceFilterState = {
  overallCompliance: [],
  documentType: "",
  roles: [],
  staffStatuses: [],
  vscStatuses: [],
  firstAidStatuses: [],
  immunizationsStatuses: [],
  covidStatuses: [],
  vscRenewalDueFrom: "",
  vscRenewalDueTo: "",
  firstAidExpiryFrom: "",
  firstAidExpiryTo: "",
  vscReminderStatuses: [],
  firstAidReminderStatuses: [],
  upcomingReminder: "",
  legacyStatus: "",
};

function parseCommaList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

const DOCUMENT_TYPE_TO_STATUS_KEY = {
  vulnerable_sector_check: "vscStatuses",
  first_aid_cpr: "firstAidStatuses",
  immunizations: "immunizationsStatuses",
  covid19_vaccination: "covidStatuses",
} as const satisfies Record<string, keyof DocumentComplianceFilterState>;

function applyLegacyStatusToState(
  state: DocumentComplianceFilterState,
  status: string,
  documentType: string,
): DocumentComplianceFilterState {
  if (!status) return state;

  if (documentType && documentType in DOCUMENT_TYPE_TO_STATUS_KEY) {
    const key = DOCUMENT_TYPE_TO_STATUS_KEY[documentType as keyof typeof DOCUMENT_TYPE_TO_STATUS_KEY];
    const existing = state[key] as DocumentReportStatus[];
    if (!existing.includes(status as DocumentReportStatus)) {
      return {
        ...state,
        documentType,
        [key]: [...existing, status as DocumentReportStatus],
      };
    }
    return { ...state, documentType };
  }

  return { ...state, legacyStatus: status };
}

export function parseDocumentComplianceFiltersFromSearch(
  search: Record<string, string | undefined>,
): DocumentComplianceFilterState {
  let state: DocumentComplianceFilterState = {
    ...EMPTY_DOCUMENT_COMPLIANCE_FILTERS,
    overallCompliance: parseCommaList(search.overallCompliance) as DocumentOverallComplianceStatus[],
    documentType: search.documentType?.trim() || "",
    roles: parseCommaList(search.roles),
    staffStatuses: parseCommaList(search.staffStatuses),
    vscStatuses: parseCommaList(search.vscStatuses) as DocumentReportStatus[],
    firstAidStatuses: parseCommaList(search.firstAidStatuses) as DocumentReportStatus[],
    immunizationsStatuses: parseCommaList(search.immunizationsStatuses) as DocumentReportStatus[],
    covidStatuses: parseCommaList(search.covidStatuses) as DocumentReportStatus[],
    vscRenewalDueFrom: search.vscRenewalDueFrom?.trim() || "",
    vscRenewalDueTo: search.vscRenewalDueTo?.trim() || "",
    firstAidExpiryFrom: search.firstAidExpiryFrom?.trim() || "",
    firstAidExpiryTo: search.firstAidExpiryTo?.trim() || "",
    vscReminderStatuses: parseCommaList(search.vscReminderStatuses),
    firstAidReminderStatuses: parseCommaList(search.firstAidReminderStatuses),
    upcomingReminder: search.upcomingReminder?.trim() || "",
    legacyStatus: "",
  };

  const legacyStatus = search.status?.trim() || "";
  if (legacyStatus) {
    state = applyLegacyStatusToState(state, legacyStatus, state.documentType);
  }

  return state;
}

export function documentComplianceFiltersToSearchParams(
  filters: DocumentComplianceFilterState,
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  if (filters.overallCompliance.length) {
    params.overallCompliance = filters.overallCompliance.join(",");
  }
  if (filters.documentType) params.documentType = filters.documentType;
  if (filters.roles.length) params.roles = filters.roles.join(",");
  if (filters.staffStatuses.length) params.staffStatuses = filters.staffStatuses.join(",");
  if (filters.vscStatuses.length) params.vscStatuses = filters.vscStatuses.join(",");
  if (filters.firstAidStatuses.length) params.firstAidStatuses = filters.firstAidStatuses.join(",");
  if (filters.immunizationsStatuses.length) {
    params.immunizationsStatuses = filters.immunizationsStatuses.join(",");
  }
  if (filters.covidStatuses.length) params.covidStatuses = filters.covidStatuses.join(",");
  if (filters.vscRenewalDueFrom) params.vscRenewalDueFrom = filters.vscRenewalDueFrom;
  if (filters.vscRenewalDueTo) params.vscRenewalDueTo = filters.vscRenewalDueTo;
  if (filters.firstAidExpiryFrom) params.firstAidExpiryFrom = filters.firstAidExpiryFrom;
  if (filters.firstAidExpiryTo) params.firstAidExpiryTo = filters.firstAidExpiryTo;
  if (filters.vscReminderStatuses.length) {
    params.vscReminderStatuses = filters.vscReminderStatuses.join(",");
  }
  if (filters.firstAidReminderStatuses.length) {
    params.firstAidReminderStatuses = filters.firstAidReminderStatuses.join(",");
  }
  if (filters.upcomingReminder) params.upcomingReminder = filters.upcomingReminder;

  if (filters.legacyStatus) {
    params.status = filters.legacyStatus;
  }

  return params;
}

export function documentComplianceFiltersToApiQuery(filters: DocumentComplianceFilterState) {
  return {
    overallCompliance: filters.overallCompliance.length ? filters.overallCompliance : undefined,
    documentType: filters.documentType || undefined,
    roles: filters.roles.length ? filters.roles : undefined,
    staffStatuses: filters.staffStatuses.length ? filters.staffStatuses : undefined,
    vscStatuses: filters.vscStatuses.length ? filters.vscStatuses : undefined,
    firstAidStatuses: filters.firstAidStatuses.length ? filters.firstAidStatuses : undefined,
    immunizationsStatuses: filters.immunizationsStatuses.length
      ? filters.immunizationsStatuses
      : undefined,
    covidStatuses: filters.covidStatuses.length ? filters.covidStatuses : undefined,
    vscRenewalDueFrom: filters.vscRenewalDueFrom || undefined,
    vscRenewalDueTo: filters.vscRenewalDueTo || undefined,
    firstAidExpiryFrom: filters.firstAidExpiryFrom || undefined,
    firstAidExpiryTo: filters.firstAidExpiryTo || undefined,
    vscReminderStatuses: filters.vscReminderStatuses.length
      ? filters.vscReminderStatuses
      : undefined,
    firstAidReminderStatuses: filters.firstAidReminderStatuses.length
      ? filters.firstAidReminderStatuses
      : undefined,
    upcomingReminder:
      filters.upcomingReminder === "has" || filters.upcomingReminder === "none"
        ? filters.upcomingReminder
        : undefined,
    status: filters.legacyStatus || undefined,
  };
}

export function validateDocumentComplianceDateRanges(filters: DocumentComplianceFilterState): string | null {
  if (
    filters.vscRenewalDueFrom &&
    filters.vscRenewalDueTo &&
    filters.vscRenewalDueFrom > filters.vscRenewalDueTo
  ) {
    return "VSC Renewal Due From must not be after To.";
  }
  if (
    filters.firstAidExpiryFrom &&
    filters.firstAidExpiryTo &&
    filters.firstAidExpiryFrom > filters.firstAidExpiryTo
  ) {
    return "First Aid Expiry From must not be after To.";
  }
  return null;
}

export function isAdvancedDocumentComplianceFilterActive(
  filters: DocumentComplianceFilterState,
): boolean {
  return (
    filters.roles.length > 0 ||
    filters.staffStatuses.length > 0 ||
    filters.vscStatuses.length > 0 ||
    filters.firstAidStatuses.length > 0 ||
    filters.immunizationsStatuses.length > 0 ||
    filters.covidStatuses.length > 0 ||
    Boolean(filters.vscRenewalDueFrom) ||
    Boolean(filters.vscRenewalDueTo) ||
    Boolean(filters.firstAidExpiryFrom) ||
    Boolean(filters.firstAidExpiryTo) ||
    filters.vscReminderStatuses.length > 0 ||
    filters.firstAidReminderStatuses.length > 0 ||
    Boolean(filters.upcomingReminder) ||
    Boolean(filters.legacyStatus)
  );
}

type FilterChipDef = {
  id: string;
  label: string;
  clear: (filters: DocumentComplianceFilterState) => DocumentComplianceFilterState;
};

function statusLabels(values: DocumentReportStatus[], optional?: boolean): string {
  return values.map((value) => documentReportStatusLabel(value, optional)).join(", ");
}

function formatChipDate(value: string): string {
  try {
    return formatDocumentDate(value);
  } catch {
    return value;
  }
}

export function buildDocumentComplianceFilterChips(
  filters: DocumentComplianceFilterState,
): FilterChipDef[] {
  const chips: FilterChipDef[] = [];

  for (const value of filters.overallCompliance) {
    chips.push({
      id: `overall-${value}`,
      label: `Overall: ${DOCUMENT_OVERALL_STATUS_LABELS[value]}`,
      clear: (current) => ({
        ...current,
        overallCompliance: current.overallCompliance.filter((item) => item !== value),
      }),
    });
  }

  if (filters.documentType) {
    const docLabel =
      DOCUMENT_TYPE_FILTER_OPTIONS.find((option) => option.value === filters.documentType)?.label ??
      filters.documentType;
    chips.push({
      id: "document-type",
      label: `Document Type: ${docLabel}`,
      clear: (current) => ({ ...current, documentType: "" }),
    });
  }

  for (const role of filters.roles) {
    chips.push({
      id: `role-${role}`,
      label: `Role: ${role}`,
      clear: (current) => ({ ...current, roles: current.roles.filter((item) => item !== role) }),
    });
  }

  for (const status of filters.staffStatuses) {
    const label =
      STAFF_STATUS_FILTER_OPTIONS.find((option) => option.value === status)?.label ?? status;
    chips.push({
      id: `staff-status-${status}`,
      label: `Staff Status: ${label}`,
      clear: (current) => ({
        ...current,
        staffStatuses: current.staffStatuses.filter((item) => item !== status),
      }),
    });
  }

  if (filters.vscStatuses.length) {
    chips.push({
      id: "vsc-statuses",
      label: `VSC: ${statusLabels(filters.vscStatuses)}`,
      clear: (current) => ({ ...current, vscStatuses: [] }),
    });
  }

  if (filters.firstAidStatuses.length) {
    chips.push({
      id: "first-aid-statuses",
      label: `First Aid: ${statusLabels(filters.firstAidStatuses)}`,
      clear: (current) => ({ ...current, firstAidStatuses: [] }),
    });
  }

  if (filters.immunizationsStatuses.length) {
    chips.push({
      id: "immunizations-statuses",
      label: `Immunizations: ${statusLabels(filters.immunizationsStatuses)}`,
      clear: (current) => ({ ...current, immunizationsStatuses: [] }),
    });
  }

  if (filters.covidStatuses.length) {
    chips.push({
      id: "covid-statuses",
      label: `COVID: ${statusLabels(filters.covidStatuses, true)}`,
      clear: (current) => ({ ...current, covidStatuses: [] }),
    });
  }

  if (filters.vscRenewalDueFrom) {
    chips.push({
      id: "vsc-renewal-from",
      label: `VSC Renewal Due ≥ ${formatChipDate(filters.vscRenewalDueFrom)}`,
      clear: (current) => ({ ...current, vscRenewalDueFrom: "" }),
    });
  }
  if (filters.vscRenewalDueTo) {
    chips.push({
      id: "vsc-renewal-to",
      label: `VSC Renewal Due ≤ ${formatChipDate(filters.vscRenewalDueTo)}`,
      clear: (current) => ({ ...current, vscRenewalDueTo: "" }),
    });
  }

  if (filters.firstAidExpiryFrom) {
    chips.push({
      id: "first-aid-from",
      label: `First Aid Expiry ≥ ${formatChipDate(filters.firstAidExpiryFrom)}`,
      clear: (current) => ({ ...current, firstAidExpiryFrom: "" }),
    });
  }
  if (filters.firstAidExpiryTo) {
    chips.push({
      id: "first-aid-to",
      label: `First Aid Expiry ≤ ${formatChipDate(filters.firstAidExpiryTo)}`,
      clear: (current) => ({ ...current, firstAidExpiryTo: "" }),
    });
  }

  for (const value of filters.vscReminderStatuses) {
    const label = REMINDER_STATUS_FILTER_OPTIONS.find((option) => option.value === value)?.label;
    chips.push({
      id: `vsc-reminder-${value}`,
      label: `VSC Reminder: ${label ?? value}`,
      clear: (current) => ({
        ...current,
        vscReminderStatuses: current.vscReminderStatuses.filter((item) => item !== value),
      }),
    });
  }

  for (const value of filters.firstAidReminderStatuses) {
    const label = REMINDER_STATUS_FILTER_OPTIONS.find((option) => option.value === value)?.label;
    chips.push({
      id: `first-aid-reminder-${value}`,
      label: `First Aid Reminder: ${label ?? value}`,
      clear: (current) => ({
        ...current,
        firstAidReminderStatuses: current.firstAidReminderStatuses.filter((item) => item !== value),
      }),
    });
  }

  if (filters.upcomingReminder) {
    const label =
      UPCOMING_REMINDER_FILTER_OPTIONS.find((option) => option.value === filters.upcomingReminder)
        ?.label ?? filters.upcomingReminder;
    chips.push({
      id: "upcoming-reminder",
      label: `Upcoming Reminder: ${label}`,
      clear: (current) => ({ ...current, upcomingReminder: "" }),
    });
  }

  if (filters.legacyStatus) {
    chips.push({
      id: "legacy-status",
      label: `Status: ${DOCUMENT_REPORT_STATUS_LABELS[filters.legacyStatus as DocumentReportStatus] ?? filters.legacyStatus}`,
      clear: (current) => ({ ...current, legacyStatus: "" }),
    });
  }

  return chips;
}

export function clearAdvancedDocumentComplianceFilters(
  filters: DocumentComplianceFilterState,
): DocumentComplianceFilterState {
  return {
    ...filters,
    roles: [],
    staffStatuses: [],
    vscStatuses: [],
    firstAidStatuses: [],
    immunizationsStatuses: [],
    covidStatuses: [],
    vscRenewalDueFrom: "",
    vscRenewalDueTo: "",
    firstAidExpiryFrom: "",
    firstAidExpiryTo: "",
    vscReminderStatuses: [],
    firstAidReminderStatuses: [],
    upcomingReminder: "",
    legacyStatus: "",
  };
}
