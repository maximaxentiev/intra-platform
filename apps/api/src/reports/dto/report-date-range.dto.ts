import {
  IsDefined,
  IsOptional,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { validateReportDateRange } from '../report-date.util';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'reportDateRange', async: false })
export class ReportDateRangeConstraint implements ValidatorConstraintInterface {
  private lastMessage = 'Invalid report date range.';

  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { dateFrom?: string; dateTo?: string };
    const { dateFrom, dateTo } = obj;

    if (dateFrom === undefined && dateTo === undefined) {
      return true;
    }
    if (!dateFrom || !dateTo) {
      this.lastMessage = 'dateFrom and dateTo must both be provided.';
      return false;
    }

    try {
      validateReportDateRange(dateFrom, dateTo);
      return true;
    } catch (err) {
      this.lastMessage = err instanceof Error ? err.message : 'Invalid report date range.';
      return false;
    }
  }

  defaultMessage(): string {
    return this.lastMessage;
  }
}

/** Reusable optional date-range query fields for report endpoints. */
export class ReportDateRangeQueryDto {
  @IsOptional()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom?: string;

  @IsOptional()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo?: string;
}

/** Shift-based reports require an explicit inclusive date range. */
export class ReportRequiredDateRangeQueryDto {
  @IsDefined()
  @Matches(DATE, { message: 'dateFrom must be YYYY-MM-DD.' })
  dateFrom!: string;

  @IsDefined()
  @Matches(DATE, { message: 'dateTo must be YYYY-MM-DD.' })
  @Validate(ReportDateRangeConstraint)
  dateTo!: string;
}
