import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import { formatReportDurationMinutes } from "@/lib/ops-report-formatters";
import type { StaffUsageSummary } from "@/lib/reports-types";
import {
  REPORT_SCHEDULED_HOURS_LABEL,
  REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL,
} from "@/lib/reports-types";

export function StaffUsageSummaryCards({
  summary,
  loading,
  ready,
}: {
  summary: StaffUsageSummary | undefined;
  loading: boolean;
  ready: boolean;
}) {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      <ReportMetricCard label="Staff Shown" value={summary?.totalStaff ?? 0} loading={loading} />
      <ReportMetricCard
        label="Completed Shifts"
        value={summary?.completedShifts ?? 0}
        loading={loading}
        tone="primary"
      />
      <ReportMetricCard
        label={REPORT_SCHEDULED_HOURS_LABEL}
        value={
          ready ? formatReportDurationMinutes(summary!.completedScheduledMinutes) : "—"
        }
        loading={loading}
      />
      <ReportMetricCard label="Filled Shifts" value={summary?.filledShifts ?? 0} loading={loading} />
      <ReportMetricCard
        label={REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL}
        value={ready ? formatReportDurationMinutes(summary!.filledScheduledMinutes) : "—"}
        loading={loading}
      />
    </ReportMetricGrid>
  );
}

export function StaffUsageSummarySkeleton() {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading />
      ))}
    </ReportMetricGrid>
  );
}
