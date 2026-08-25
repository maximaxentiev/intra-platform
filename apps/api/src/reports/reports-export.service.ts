import { Injectable } from '@nestjs/common';
import type { ActivityLogQueryDto } from './dto/activity-log-query.dto';
import type { CentreUsageQueryDto } from './dto/centre-usage-query.dto';
import type { CentreUsageShiftsQueryDto } from './dto/centre-usage-shifts-query.dto';
import type { DocumentComplianceQueryDto } from './dto/document-compliance-query.dto';
import type { ShiftReportQueryDto } from './dto/shift-report-query.dto';
import type { StaffUsageQueryDto } from './dto/staff-usage-query.dto';
import {
  activityCategoryCsvLabel,
  documentStatusCsvLabel,
  DOCUMENT_OVERALL_CSV_LABELS,
  reminderStatusCsvLabel,
} from './report-csv-labels.util';
import {
  buildCsvContent,
  csvNumberCell,
  csvTextCell,
  formatCsvDateOnly,
  formatCsvTimeOnly,
  formatTorontoTimestampForCsv,
  minutesToCsvHours,
  reportCsvFilename,
} from './report-csv.util';
import { ReportsActivityService } from './reports-activity.service';
import { ReportsDocumentsService } from './reports-documents.service';
import { ReportsShiftService } from './reports-shift.service';
import { ReportsStaffService } from './reports-staff.service';

export type ReportCsvExportResult = {
  content: string;
  filename: string;
  rowCount: number;
};

@Injectable()
export class ReportsExportService {
  constructor(
    private readonly reportsShift: ReportsShiftService,
    private readonly reportsStaff: ReportsStaffService,
    private readonly reportsDocuments: ReportsDocumentsService,
    private readonly reportsActivity: ReportsActivityService,
  ) {}

  async exportShiftFulfillment(query: ShiftReportQueryDto): Promise<ReportCsvExportResult> {
    const { dateFrom, dateTo, rows } = await this.reportsShift.getShiftFulfillmentExportRows(query);
    const headers = [
      'Centre',
      'Total Shifts',
      'Fill Rate (%)',
      'Pending',
      'Filled',
      'Completed',
      'Cancelled',
    ];
    const body = rows.map((row) => [
      csvTextCell(row.centreName),
      csvNumberCell(row.totalShifts),
      csvNumberCell(row.fillRatePercent ?? undefined),
      csvNumberCell(row.pending),
      csvNumberCell(row.filled),
      csvNumberCell(row.completed),
      csvNumberCell(row.cancelled),
    ]);
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('shift-fulfillment', dateFrom, dateTo),
      rowCount: rows.length,
    };
  }

  async exportCentreUsage(query: CentreUsageQueryDto): Promise<ReportCsvExportResult> {
    const { dateFrom, dateTo, rows } = await this.reportsShift.getCentreUsageExportRows(query);
    const headers = [
      'Centre',
      'Total Shifts',
      'Fill Rate (%)',
      'Pending',
      'Filled',
      'Completed',
      'Cancelled',
      'Scheduled Hours',
      'Scheduled Hours on Completed Shifts',
    ];
    const body = rows.map((row) => [
      csvTextCell(row.centreName),
      csvNumberCell(row.totalShifts),
      csvNumberCell(row.fillRatePercent ?? undefined),
      csvNumberCell(row.pending),
      csvNumberCell(row.filled),
      csvNumberCell(row.completed),
      csvNumberCell(row.cancelled),
      csvNumberCell(minutesToCsvHours(row.totalScheduledMinutes)),
      csvNumberCell(minutesToCsvHours(row.completedScheduledMinutes)),
    ]);
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('centre-usage', dateFrom, dateTo),
      rowCount: rows.length,
    };
  }

  async exportCentreUsageShifts(
    query: CentreUsageShiftsQueryDto,
  ): Promise<ReportCsvExportResult> {
    const { dateFrom, dateTo, rows } =
      await this.reportsShift.getCentreUsageShiftsExportRows(query);
    const headers = [
      'Date',
      'Centre',
      'Staff',
      'Role',
      'Status',
      'Scheduled Start',
      'Scheduled End',
      'Scheduled Hours',
      'Shift ID',
    ];
    const body = rows.map((row) => [
      csvTextCell(formatCsvDateOnly(row.shiftDate)),
      csvTextCell(row.centreName),
      csvTextCell(row.staffName),
      csvTextCell(row.role),
      csvTextCell(row.statusLabel),
      csvTextCell(formatCsvTimeOnly(row.startTime)),
      csvTextCell(formatCsvTimeOnly(row.endTime)),
      csvNumberCell(minutesToCsvHours(row.scheduledMinutes)),
      csvTextCell(row.shiftId),
    ]);
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('centre-usage-shift-detail', dateFrom, dateTo),
      rowCount: rows.length,
    };
  }

  async exportStaffUsage(query: StaffUsageQueryDto): Promise<ReportCsvExportResult> {
    const { dateFrom, dateTo, rows } = await this.reportsStaff.getStaffUsageExportRows(query);
    const headers = [
      'Staff',
      'Role',
      'Completed Shifts',
      'Scheduled Hours on Completed Shifts',
      'Filled Shifts',
      'Scheduled Hours on Filled Shifts',
    ];
    const body = rows.map((row) => [
      csvTextCell(row.staffName),
      csvTextCell(row.role),
      csvNumberCell(row.completedShifts),
      csvNumberCell(minutesToCsvHours(row.completedScheduledMinutes)),
      csvNumberCell(row.filledShifts),
      csvNumberCell(minutesToCsvHours(row.filledScheduledMinutes)),
    ]);
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('staff-usage', dateFrom, dateTo),
      rowCount: rows.length,
    };
  }

  async exportDocumentCompliance(query: DocumentComplianceQueryDto): Promise<ReportCsvExportResult> {
    const { rows } = await this.reportsDocuments.getDocumentComplianceExportRows(query);
    const headers = [
      'Staff Name',
      'Role',
      'Overall Compliance',
      'VSC Status',
      'VSC Processed Date',
      'VSC Renewal Due',
      'VSC Latest Reminder Status',
      'VSC Latest Reminder Sent At',
      'VSC Next Reminder At',
      'First Aid Status',
      'First Aid Expiry Date',
      'First Aid Latest Reminder Status',
      'First Aid Latest Reminder Sent At',
      'First Aid Next Reminder At',
      'Immunizations Status',
      'Immunizations Submitted At',
      'COVID Status',
      'COVID Submitted At',
    ];
    const body = rows.map((row) => {
      const vsc = row.documents.vulnerableSectorCheck;
      const firstAid = row.documents.firstAidCpr;
      const immunizations = row.documents.immunizations;
      const covid = row.documents.covid19Vaccination;
      return [
        csvTextCell(row.staffName),
        csvTextCell(row.role),
        csvTextCell(DOCUMENT_OVERALL_CSV_LABELS[row.overallComplianceStatus]),
        csvTextCell(documentStatusCsvLabel(vsc.status)),
        csvTextCell(formatCsvDateOnly(vsc.processedDate)),
        csvTextCell(formatCsvDateOnly(vsc.expiryDate)),
        csvTextCell(reminderStatusCsvLabel(vsc.latestReminderStatus)),
        csvTextCell(
          vsc.latestReminderSentAt
            ? formatTorontoTimestampForCsv(vsc.latestReminderSentAt)
            : '',
        ),
        csvTextCell(
          vsc.nextReminderAt ? formatTorontoTimestampForCsv(vsc.nextReminderAt) : '',
        ),
        csvTextCell(documentStatusCsvLabel(firstAid.status)),
        csvTextCell(formatCsvDateOnly(firstAid.expiryDate)),
        csvTextCell(reminderStatusCsvLabel(firstAid.latestReminderStatus)),
        csvTextCell(
          firstAid.latestReminderSentAt
            ? formatTorontoTimestampForCsv(firstAid.latestReminderSentAt)
            : '',
        ),
        csvTextCell(
          firstAid.nextReminderAt ? formatTorontoTimestampForCsv(firstAid.nextReminderAt) : '',
        ),
        csvTextCell(documentStatusCsvLabel(immunizations.status)),
        csvTextCell(
          immunizations.submittedAt
            ? formatTorontoTimestampForCsv(immunizations.submittedAt)
            : '',
        ),
        csvTextCell(documentStatusCsvLabel(covid.status, true)),
        csvTextCell(
          covid.submittedAt ? formatTorontoTimestampForCsv(covid.submittedAt) : '',
        ),
      ];
    });
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('document-compliance'),
      rowCount: rows.length,
    };
  }

  async exportActivityLog(query: ActivityLogQueryDto): Promise<ReportCsvExportResult> {
    const { dateFrom, dateTo, items } = await this.reportsActivity.getActivityLogExportItems(query);
    const headers = [
      'Timestamp',
      'Category',
      'Action',
      'Activity',
      'Description',
      'Actor',
      'Actor Type',
      'Staff',
      'Centre',
      'Shift ID',
    ];
    const body = items.map((item) => [
      csvTextCell(formatTorontoTimestampForCsv(item.occurredAt)),
      csvTextCell(activityCategoryCsvLabel(item.category)),
      csvTextCell(item.action),
      csvTextCell(item.title),
      csvTextCell(item.description),
      csvTextCell(item.actor.name ?? ''),
      csvTextCell(item.actor.type),
      csvTextCell(item.staff?.name ?? ''),
      csvTextCell(item.centre?.name ?? ''),
      csvTextCell(item.shift?.id ?? ''),
    ]);
    return {
      content: buildCsvContent(headers, body),
      filename: reportCsvFilename('activity-log', dateFrom, dateTo),
      rowCount: items.length,
    };
  }
}
