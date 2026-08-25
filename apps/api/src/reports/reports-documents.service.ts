import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../db/drizzle.module';
import {
  communicationDeliveries,
  scheduledCommunications,
  staff,
  staffDocumentFiles,
  staffDocumentSets,
  staffDocumentSubmissions,
} from '../db/schema';
import {
  STAFF_DOCUMENT_REMINDER_TYPES,
  type StaffDocumentType,
} from '../staff-documents/staff-document.constants';
import {
  buildCategoryComplianceMap,
  buildComplianceInputsForStaff,
  type StaffDocumentCategoryCompliance,
} from '../staff-documents/staff-document-compliance.util';
import type { DocumentComplianceQueryDto } from './dto/document-compliance-query.dto';
import { resolveStaffUsageStaffIds } from './dto/report-staff-ids.util';
import {
  buildDocumentPerTypeStatusFilters,
  staffMatchesDocumentComplianceFilters,
} from './report-document-filter.util';
import {
  buildReminderSummariesForSubmissions,
  type DocumentReminderSummary,
} from './report-document-reminder.util';
import {
  buildDocumentStatusMap,
  deriveDocumentReportStatus,
  deriveOverallComplianceStatus,
  type DocumentReportStatus,
} from './report-document-status.util';
import {
  paginateReportRows,
  parseComparisonReportPagination,
} from './report-comparison-pagination.util';
import { formatStaffReportName, formatStaffReportRole } from './report-staff-name.util';
import { ReportsService } from './reports.service';
import type {
  DocumentComplianceResponse,
  DocumentComplianceRow,
  DocumentComplianceSummary,
  DocumentReportDocuments,
} from './types/document-report.types';
import { DOCUMENT_REPORT_DEFAULT_PAGE_SIZE } from './types/document-report.types';

type StaffRosterRow = {
  staffId: string;
  legalName: string;
  displayName: string;
  useDisplayName: boolean;
  role: string | null;
};

function emptyReminderSummary(): DocumentReminderSummary {
  return {
    latestReminderStatus: null,
    latestReminderSentAt: null,
    nextReminderAt: null,
  };
}

function buildDocumentCategoryFields(
  category: StaffDocumentCategoryCompliance,
  reminder: DocumentReminderSummary,
): DocumentReportDocuments['vulnerableSectorCheck'] {
  return {
    status: deriveDocumentReportStatus(category),
    submittedAt: category.submittedAt,
    reviewedAt: category.reviewedAt,
    processedDate: category.processedDate,
    expiryDate: category.expiryDate,
    latestReminderStatus: reminder.latestReminderStatus,
    latestReminderSentAt: reminder.latestReminderSentAt,
    nextReminderAt: reminder.nextReminderAt,
  };
}

function buildSummary(rows: DocumentComplianceRow[]): DocumentComplianceSummary {
  const summary: DocumentComplianceSummary = {
    staffShown: rows.length,
    compliant: 0,
    expiringSoon: 0,
    needsAttention: 0,
    pendingReview: 0,
    issueFlagged: 0,
    expired: 0,
  };

  for (const row of rows) {
    if (row.overallComplianceStatus === 'compliant') summary.compliant += 1;
    if (row.overallComplianceStatus === 'expiring_soon') summary.expiringSoon += 1;
    if (row.overallComplianceStatus === 'needs_attention') summary.needsAttention += 1;

    const requiredStatuses = (
      ['vulnerable_sector_check', 'first_aid_cpr', 'immunizations'] as const
    ).map((type) => row.documents[documentKeyForType(type)].status);

    if (requiredStatuses.includes('pending_review')) summary.pendingReview += 1;
    if (requiredStatuses.includes('issue_flagged')) summary.issueFlagged += 1;
    if (requiredStatuses.includes('expired')) summary.expired += 1;
  }

  return summary;
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

@Injectable()
export class ReportsDocumentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly reports: ReportsService,
  ) {}

  async getDocumentCompliance(query: DocumentComplianceQueryDto): Promise<DocumentComplianceResponse> {
    const { staffIds, filteredRows } = await this.resolveDocumentComplianceFilteredRows(query);
    const { page, pageSize } = parseComparisonReportPagination({
      page: query.page,
      pageSize: query.pageSize ?? DOCUMENT_REPORT_DEFAULT_PAGE_SIZE,
    });

    const summary = buildSummary(filteredRows);
    const paginated = paginateReportRows(filteredRows, page, pageSize);

    return {
      staffIds,
      status: query.status ?? null,
      documentType: query.documentType ?? null,
      summary,
      items: paginated.items,
      page: paginated.page,
      pageSize: paginated.pageSize,
      totalCount: paginated.totalCount,
      hasMore: paginated.hasMore,
    };
  }

  async getDocumentComplianceExportRows(query: DocumentComplianceQueryDto) {
    const { filteredRows } = await this.resolveDocumentComplianceFilteredRows(query);
    return { rows: filteredRows };
  }

  /** Staff document compliance summary — same semantics as the Document Compliance report default. */
  async getActiveStaffComplianceSummary(): Promise<DocumentComplianceSummary> {
    const { filteredRows } = await this.resolveDocumentComplianceFilteredRows({});
    return buildSummary(filteredRows);
  }

  private async resolveDocumentComplianceFilteredRows(query: DocumentComplianceQueryDto) {
    const staffIds = resolveStaffUsageStaffIds(query);

    if (staffIds?.length) {
      await this.reports.assertStaffMembersExist(staffIds);
    }

    const staffConditions = this.buildStaffConditions(staffIds, query.roles);

    const rosterRows = await this.db
      .select({
        staffId: staff.id,
        legalName: staff.legalName,
        displayName: staff.displayName,
        useDisplayName: staff.useDisplayName,
        role: staff.role,
      })
      .from(staff)
      .where(staffConditions)
      .orderBy(asc(staff.legalName));

    const rosterStaffIds = rosterRows.map((row) => row.staffId);
    const complianceByStaff = await this.loadComplianceByStaffIds(rosterStaffIds);
    const reminderBySubmission = await this.loadReminderSummaries(complianceByStaff);

    const allRows = rosterRows.map((row) =>
      this.buildRow(row, complianceByStaff.get(row.staffId)!, reminderBySubmission),
    );

    const perDocumentStatuses = buildDocumentPerTypeStatusFilters({
      vscStatuses: query.vscStatuses,
      firstAidStatuses: query.firstAidStatuses,
      immunizationsStatuses: query.immunizationsStatuses,
      covidStatuses: query.covidStatuses,
    });

    const filteredRows = allRows.filter((row) =>
      staffMatchesDocumentComplianceFilters(row, {
        overallCompliance: query.overallCompliance,
        perDocumentStatuses,
        vscRenewalDueFrom: query.vscRenewalDueFrom,
        vscRenewalDueTo: query.vscRenewalDueTo,
        firstAidExpiryFrom: query.firstAidExpiryFrom,
        firstAidExpiryTo: query.firstAidExpiryTo,
        vscReminderStatuses: query.vscReminderStatuses,
        firstAidReminderStatuses: query.firstAidReminderStatuses,
        upcomingReminder: query.upcomingReminder,
        status: query.status,
        documentType: query.documentType,
      }),
    );

    return { staffIds, filteredRows };
  }

  private buildStaffConditions(staffIds: string[] | null, roles?: string[]) {
    const conditions = [];

    if (staffIds?.length) {
      conditions.push(inArray(staff.id, staffIds));
    }

    if (roles?.length) {
      conditions.push(inArray(staff.role, roles));
    }

    return conditions.length ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined;
  }

  private buildRow(
    row: StaffRosterRow,
    categories: Map<StaffDocumentType, StaffDocumentCategoryCompliance>,
    reminderBySubmission: Map<string, DocumentReminderSummary>,
  ): DocumentComplianceRow {
    const vsc = categories.get('vulnerable_sector_check')!;
    const firstAid = categories.get('first_aid_cpr')!;
    const immunizations = categories.get('immunizations')!;
    const covid = categories.get('covid19_vaccination')!;

    const vscReminder = vsc.currentSubmissionId
      ? (reminderBySubmission.get(vsc.currentSubmissionId) ?? emptyReminderSummary())
      : emptyReminderSummary();
    const firstAidReminder = firstAid.currentSubmissionId
      ? (reminderBySubmission.get(firstAid.currentSubmissionId) ?? emptyReminderSummary())
      : emptyReminderSummary();

    return {
      staffId: row.staffId,
      staffName: formatStaffReportName(row),
      role: formatStaffReportRole(row.role),
      overallComplianceStatus: deriveOverallComplianceStatus(categories),
      documents: {
        vulnerableSectorCheck: buildDocumentCategoryFields(vsc, vscReminder),
        firstAidCpr: {
          status: deriveDocumentReportStatus(firstAid),
          submittedAt: firstAid.submittedAt,
          expiryDate: firstAid.expiryDate,
          reviewedAt: firstAid.reviewedAt,
          latestReminderStatus: firstAidReminder.latestReminderStatus,
          latestReminderSentAt: firstAidReminder.latestReminderSentAt,
          nextReminderAt: firstAidReminder.nextReminderAt,
        },
        immunizations: {
          status: deriveDocumentReportStatus(immunizations),
          submittedAt: immunizations.submittedAt,
          reviewedAt: immunizations.reviewedAt,
        },
        covid19Vaccination: {
          status: deriveDocumentReportStatus(covid),
          optional: true,
          submittedAt: covid.submittedAt,
          reviewedAt: covid.reviewedAt,
        },
      },
    };
  }

  /** Three-query compliance batch (sets, submissions, file counts). */
  private async loadComplianceByStaffIds(
    staffIds: string[],
  ): Promise<Map<string, Map<StaffDocumentType, StaffDocumentCategoryCompliance>>> {
    const result = new Map<string, Map<StaffDocumentType, StaffDocumentCategoryCompliance>>();
    if (staffIds.length === 0) {
      return result;
    }

    const sets =
      staffIds.length > 0
        ? await this.db
            .select()
            .from(staffDocumentSets)
            .where(inArray(staffDocumentSets.staffId, staffIds))
        : [];

    const setsByStaff = new Map<string, typeof sets>();
    for (const set of sets) {
      const list = setsByStaff.get(set.staffId) ?? [];
      list.push(set);
      setsByStaff.set(set.staffId, list);
    }

    const currentSubmissionIds = [
      ...new Set(
        sets.map((set) => set.currentSubmissionId).filter((id): id is string => Boolean(id)),
      ),
    ];

    const submissions =
      currentSubmissionIds.length > 0
        ? await this.db
            .select()
            .from(staffDocumentSubmissions)
            .where(inArray(staffDocumentSubmissions.id, currentSubmissionIds))
        : [];

    const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));

    const fileRows =
      currentSubmissionIds.length > 0
        ? await this.db
            .select({ submissionId: staffDocumentFiles.submissionId })
            .from(staffDocumentFiles)
            .where(inArray(staffDocumentFiles.submissionId, currentSubmissionIds))
        : [];

    const fileCountBySubmission = new Map<string, number>();
    for (const row of fileRows) {
      fileCountBySubmission.set(
        row.submissionId,
        (fileCountBySubmission.get(row.submissionId) ?? 0) + 1,
      );
    }

    for (const staffId of staffIds) {
      const staffSets = setsByStaff.get(staffId) ?? [];
      const inputs = buildComplianceInputsForStaff(staffSets, submissionById, fileCountBySubmission);
      result.set(staffId, buildCategoryComplianceMap(inputs));
    }

    return result;
  }

  /** Two-query reminder batch for VSC/First Aid current submissions. */
  private async loadReminderSummaries(
    complianceByStaff: Map<string, Map<StaffDocumentType, StaffDocumentCategoryCompliance>>,
  ): Promise<Map<string, DocumentReminderSummary>> {
    const submissionIds: string[] = [];

    for (const categories of complianceByStaff.values()) {
      for (const reminderType of STAFF_DOCUMENT_REMINDER_TYPES) {
        const category = categories.get(reminderType);
        if (category?.currentSubmissionId) {
          submissionIds.push(category.currentSubmissionId);
        }
      }
    }

    const uniqueSubmissionIds = [...new Set(submissionIds)];
    if (uniqueSubmissionIds.length === 0) {
      return new Map();
    }

    const scheduledRows = await this.db
      .select({
        id: scheduledCommunications.id,
        entityId: scheduledCommunications.entityId,
        scheduledFor: scheduledCommunications.scheduledFor,
        status: scheduledCommunications.status,
        communicationType: scheduledCommunications.communicationType,
      })
      .from(scheduledCommunications)
      .where(
        and(
          eq(scheduledCommunications.entityType, 'staff_document'),
          inArray(scheduledCommunications.entityId, uniqueSubmissionIds),
        ),
      );

    const scheduledIds = scheduledRows.map((row) => row.id);
    const deliveryRows =
      scheduledIds.length > 0
        ? await this.db
            .select({
              scheduledCommunicationId: communicationDeliveries.scheduledCommunicationId,
              status: communicationDeliveries.status,
              sentAt: communicationDeliveries.sentAt,
              attemptedAt: communicationDeliveries.attemptedAt,
            })
            .from(communicationDeliveries)
            .where(inArray(communicationDeliveries.scheduledCommunicationId, scheduledIds))
        : [];

    return buildReminderSummariesForSubmissions(uniqueSubmissionIds, scheduledRows, deliveryRows);
  }
}
