import type { StaffDocumentType } from '../staff-documents/staff-document.constants';
import type { DocumentReminderSummary } from './report-document-reminder.util';
import {
  staffMatchesDocumentStatusFilter,
  type DocumentOverallComplianceStatus,
  type DocumentReportReminderStatus,
  type DocumentReportStatus,
} from './report-document-status.util';
import type { DocumentComplianceRow, DocumentReportDocuments } from './types/document-report.types';

export type DocumentPerTypeStatusFilters = Partial<
  Record<StaffDocumentType, DocumentReportStatus[]>
>;

/** Reminder filter values include explicit "none" for no reminder activity. */
export type DocumentReminderFilterStatus = DocumentReportReminderStatus | 'none';

export interface DocumentComplianceFilterInput {
  overallCompliance?: DocumentOverallComplianceStatus[];
  perDocumentStatuses?: DocumentPerTypeStatusFilters;
  vscRenewalDueFrom?: string;
  vscRenewalDueTo?: string;
  firstAidExpiryFrom?: string;
  firstAidExpiryTo?: string;
  vscReminderStatuses?: DocumentReminderFilterStatus[];
  firstAidReminderStatuses?: DocumentReminderFilterStatus[];
  upcomingReminder?: 'has' | 'none';
  status?: DocumentReportStatus;
  documentType?: StaffDocumentType;
}

const DOCUMENT_TYPE_TO_KEY = {
  vulnerable_sector_check: 'vulnerableSectorCheck',
  first_aid_cpr: 'firstAidCpr',
  immunizations: 'immunizations',
  covid19_vaccination: 'covid19Vaccination',
} as const satisfies Record<StaffDocumentType, keyof DocumentReportDocuments>;

function documentKeyForType(type: StaffDocumentType): keyof DocumentReportDocuments {
  return DOCUMENT_TYPE_TO_KEY[type];
}

export function statusRecordFromRow(
  row: DocumentComplianceRow,
): Record<StaffDocumentType, DocumentReportStatus> {
  return {
    vulnerable_sector_check: row.documents.vulnerableSectorCheck.status,
    first_aid_cpr: row.documents.firstAidCpr.status,
    immunizations: row.documents.immunizations.status,
    covid19_vaccination: row.documents.covid19Vaccination.status,
  };
}

function dateInRange(value: string | null | undefined, from?: string, to?: string): boolean {
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function reminderStatusValue(reminder: DocumentReminderSummary): DocumentReminderFilterStatus {
  return reminder.latestReminderStatus ?? 'none';
}

function matchesReminderStatuses(
  reminder: DocumentReminderSummary,
  allowed?: DocumentReminderFilterStatus[],
): boolean {
  if (!allowed?.length) return true;
  return allowed.includes(reminderStatusValue(reminder));
}

function matchesPerDocumentOrGroups(
  row: DocumentComplianceRow,
  groups: DocumentPerTypeStatusFilters,
): boolean {
  for (const [type, statuses] of Object.entries(groups) as Array<
    [StaffDocumentType, DocumentReportStatus[] | undefined]
  >) {
    if (!statuses?.length) continue;
    const docStatus = statusRecordFromRow(row)[type];
    if (!statuses.includes(docStatus)) return false;
  }
  return true;
}

function matchesUpcomingReminderFilter(
  row: DocumentComplianceRow,
  upcomingReminder?: 'has' | 'none',
): boolean {
  if (!upcomingReminder) return true;
  const hasUpcoming =
    Boolean(row.documents.vulnerableSectorCheck.nextReminderAt) ||
    Boolean(row.documents.firstAidCpr.nextReminderAt);
  return upcomingReminder === 'has' ? hasUpcoming : !hasUpcoming;
}

/** OR within one filter group; AND across groups. */
export function staffMatchesDocumentComplianceFilters(
  row: DocumentComplianceRow,
  input: DocumentComplianceFilterInput,
): boolean {
  if (input.overallCompliance?.length) {
    if (!input.overallCompliance.includes(row.overallComplianceStatus)) return false;
  }

  if (input.status) {
    if (
      !staffMatchesDocumentStatusFilter({
        documents: statusRecordFromRow(row),
        filterStatus: input.status,
        documentType: input.documentType,
      })
    ) {
      return false;
    }
  }

  if (input.perDocumentStatuses && Object.keys(input.perDocumentStatuses).length > 0) {
    if (!matchesPerDocumentOrGroups(row, input.perDocumentStatuses)) return false;
  }

  if (input.vscRenewalDueFrom || input.vscRenewalDueTo) {
    if (
      !dateInRange(
        row.documents.vulnerableSectorCheck.expiryDate,
        input.vscRenewalDueFrom,
        input.vscRenewalDueTo,
      )
    ) {
      return false;
    }
  }

  if (input.firstAidExpiryFrom || input.firstAidExpiryTo) {
    if (
      !dateInRange(row.documents.firstAidCpr.expiryDate, input.firstAidExpiryFrom, input.firstAidExpiryTo)
    ) {
      return false;
    }
  }

  if (
    !matchesReminderStatuses(
      {
        latestReminderStatus: row.documents.vulnerableSectorCheck.latestReminderStatus,
        latestReminderSentAt: row.documents.vulnerableSectorCheck.latestReminderSentAt,
        nextReminderAt: row.documents.vulnerableSectorCheck.nextReminderAt,
      },
      input.vscReminderStatuses,
    )
  ) {
    return false;
  }

  if (
    !matchesReminderStatuses(
      {
        latestReminderStatus: row.documents.firstAidCpr.latestReminderStatus,
        latestReminderSentAt: row.documents.firstAidCpr.latestReminderSentAt,
        nextReminderAt: row.documents.firstAidCpr.nextReminderAt,
      },
      input.firstAidReminderStatuses,
    )
  ) {
    return false;
  }

  if (!matchesUpcomingReminderFilter(row, input.upcomingReminder)) return false;

  return true;
}

export function buildDocumentPerTypeStatusFilters(input: {
  vscStatuses?: DocumentReportStatus[];
  firstAidStatuses?: DocumentReportStatus[];
  immunizationsStatuses?: DocumentReportStatus[];
  covidStatuses?: DocumentReportStatus[];
}): DocumentPerTypeStatusFilters {
  const filters: DocumentPerTypeStatusFilters = {};
  if (input.vscStatuses?.length) filters.vulnerable_sector_check = input.vscStatuses;
  if (input.firstAidStatuses?.length) filters.first_aid_cpr = input.firstAidStatuses;
  if (input.immunizationsStatuses?.length) filters.immunizations = input.immunizationsStatuses;
  if (input.covidStatuses?.length) filters.covid19_vaccination = input.covidStatuses;
  return filters;
}

export { documentKeyForType };
