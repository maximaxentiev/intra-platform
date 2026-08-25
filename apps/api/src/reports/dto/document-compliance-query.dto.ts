import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { STAFF_CANONICAL_ROLES } from '../../staff/staff-role.util';
import { STAFF_DOCUMENT_TYPE_VALUES, type StaffDocumentType } from '../../staff-documents/staff-document.constants';
import {
  DOCUMENT_OVERALL_COMPLIANCE_VALUES,
  DOCUMENT_REPORT_STATUS_VALUES,
  type DocumentOverallComplianceStatus,
  type DocumentReportStatus,
} from '../report-document-status.util';
import { REPORT_MAX_PAGE_SIZE } from '../report-pagination.util';
import { ReportStaffFilterQueryDto } from './report-staff-filter.dto';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';
import type { DocumentReminderFilterStatus } from '../report-document-filter.util';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REMINDER_FILTER_VALUES = ['sent', 'failed', 'scheduled', 'none'] as const;
const UPCOMING_REMINDER_VALUES = ['has', 'none'] as const;

function parseCommaSeparatedEnum<T extends string>(value: unknown): T[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) return value as T[];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean) as T[];
}

export class DocumentComplianceQueryDto extends ReportStaffFilterQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseReportStaffIds(value))
  @IsUUID('4', { each: true })
  @ArrayMaxSize(MAX_REPORT_STAFF_IDS, {
    message: `staffIds may include at most ${MAX_REPORT_STAFF_IDS} staff members.`,
  })
  staffIds?: string[];

  @IsOptional()
  @IsIn([...DOCUMENT_REPORT_STATUS_VALUES])
  status?: DocumentReportStatus;

  @IsOptional()
  @IsIn([...STAFF_DOCUMENT_TYPE_VALUES])
  documentType?: StaffDocumentType;

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentOverallComplianceStatus>(value))
  @IsIn([...DOCUMENT_OVERALL_COMPLIANCE_VALUES], { each: true })
  overallCompliance?: DocumentOverallComplianceStatus[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<string>(value))
  @IsIn([...STAFF_CANONICAL_ROLES], { each: true })
  roles?: string[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReportStatus>(value))
  @IsIn([...DOCUMENT_REPORT_STATUS_VALUES], { each: true })
  vscStatuses?: DocumentReportStatus[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReportStatus>(value))
  @IsIn([...DOCUMENT_REPORT_STATUS_VALUES], { each: true })
  firstAidStatuses?: DocumentReportStatus[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReportStatus>(value))
  @IsIn([...DOCUMENT_REPORT_STATUS_VALUES], { each: true })
  immunizationsStatuses?: DocumentReportStatus[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReportStatus>(value))
  @IsIn([...DOCUMENT_REPORT_STATUS_VALUES], { each: true })
  covidStatuses?: DocumentReportStatus[];

  @IsOptional()
  @Matches(DATE, { message: 'vscRenewalDueFrom must be YYYY-MM-DD.' })
  vscRenewalDueFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'vscRenewalDueTo must be YYYY-MM-DD.' })
  vscRenewalDueTo?: string;

  @IsOptional()
  @Matches(DATE, { message: 'firstAidExpiryFrom must be YYYY-MM-DD.' })
  firstAidExpiryFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'firstAidExpiryTo must be YYYY-MM-DD.' })
  firstAidExpiryTo?: string;

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReminderFilterStatus>(value))
  @IsIn([...REMINDER_FILTER_VALUES], { each: true })
  vscReminderStatuses?: DocumentReminderFilterStatus[];

  @IsOptional()
  @Transform(({ value }) => parseCommaSeparatedEnum<DocumentReminderFilterStatus>(value))
  @IsIn([...REMINDER_FILTER_VALUES], { each: true })
  firstAidReminderStatuses?: DocumentReminderFilterStatus[];

  @IsOptional()
  @IsIn([...UPCOMING_REMINDER_VALUES])
  upcomingReminder?: 'has' | 'none';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(REPORT_MAX_PAGE_SIZE)
  pageSize?: number;
}
