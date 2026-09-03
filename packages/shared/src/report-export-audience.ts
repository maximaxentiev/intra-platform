export const REPORT_EXPORT_AUDIENCES = ['ops', 'centre'] as const;

export type ReportExportAudience = (typeof REPORT_EXPORT_AUDIENCES)[number];

export const DEFAULT_REPORT_EXPORT_AUDIENCE: ReportExportAudience = 'ops';

export function isReportExportAudience(value: string): value is ReportExportAudience {
  return (REPORT_EXPORT_AUDIENCES as readonly string[]).includes(value);
}
