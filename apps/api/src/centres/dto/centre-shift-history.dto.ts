import { ReportRequiredDateRangeQueryDto } from '../../reports/dto/report-date-range.dto';

/** Centre shift history date range — both boundaries required. */
export class CentreShiftHistoryQueryDto extends ReportRequiredDateRangeQueryDto {}

export class CentreShiftHistoryEmailDto extends ReportRequiredDateRangeQueryDto {}
