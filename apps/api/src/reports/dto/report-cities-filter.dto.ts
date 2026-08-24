import { SUPPORTED_CITIES, type SupportedCity } from '@intra/shared';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsOptional,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';
import { MAX_REPORT_CITIES, normalizeReportCitiesList, parseReportCities } from './report-cities.util';
import { ReportPaginationQueryDto } from './report-pagination.dto';

@ValidatorConstraint({ name: 'reportSupportedCities', async: false })
export class ReportSupportedCitiesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null) {
      return true;
    }
    if (!Array.isArray(value)) {
      return false;
    }
    return value.every(
      (entry) => typeof entry === 'string' && (SUPPORTED_CITIES as readonly string[]).includes(entry),
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must contain only supported canonical city names.`;
  }
}

/** Optional city filter shared by centre comparison reports. */
export class ReportCitiesFilterQueryDto extends ReportPaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => normalizeReportCitiesList(parseReportCities(value)))
  @Validate(ReportSupportedCitiesConstraint)
  @IsIn(SUPPORTED_CITIES as unknown as string[], { each: true })
  @ArrayMaxSize(MAX_REPORT_CITIES, {
    message: `cities may include at most ${MAX_REPORT_CITIES} cities.`,
  })
  cities?: SupportedCity[];
}
