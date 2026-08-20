import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { STAFF_DOCUMENT_TYPE_VALUES, type StaffDocumentType } from '../../staff-documents/staff-document.constants';
import {
  DOCUMENT_REPORT_STATUS_VALUES,
  type DocumentReportStatus,
} from '../report-document-status.util';
import { REPORT_MAX_PAGE_SIZE } from '../report-pagination.util';
import { ReportStaffFilterQueryDto } from './report-staff-filter.dto';
import { MAX_REPORT_STAFF_IDS, parseReportStaffIds } from './report-staff-ids.util';

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
