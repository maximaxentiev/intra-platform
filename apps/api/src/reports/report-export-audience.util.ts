import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_REPORT_EXPORT_AUDIENCE,
  type ReportExportAudience,
} from '@intra/shared';

export function resolveReportExportAudience(
  audience: ReportExportAudience | undefined,
): ReportExportAudience {
  return audience ?? DEFAULT_REPORT_EXPORT_AUDIENCE;
}

/** Centre-facing exports require exactly one selected Centre to avoid cross-centre leakage. */
export function assertCentreExportAudienceAllowed(
  audience: ReportExportAudience,
  centreIds: string[],
): void {
  if (audience === 'centre' && centreIds.length !== 1) {
    throw new BadRequestException(
      'Select a single Centre before exporting a Centre version.',
    );
  }
}
