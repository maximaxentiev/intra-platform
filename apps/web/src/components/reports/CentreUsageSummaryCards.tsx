import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import {
  formatReportDurationMinutes,
  formatReportFillRatePercent,
} from "@/lib/ops-report-formatters";
import type { CentreUsageSummary } from "@/lib/reports-types";
import { REPORT_SCHEDULED_HOURS_LABEL } from "@/lib/reports-types";

export function CentreUsageSummaryCards({
  summary,
  loading,
  ready,
}: {
  summary: CentreUsageSummary | undefined;
  loading: boolean;
  ready: boolean;
}) {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      <ReportMetricCard label="Centres Shown" value={summary?.totalCentres ?? 0} loading={loading} />
      <ReportMetricCard
        label="Total Shifts"
        value={summary?.totalShifts ?? 0}
        loading={loading}
        tone="primary"
      />
      <ReportMetricCard
        label="Fill Rate"
        value={ready ? formatReportFillRatePercent(summary!.fillRatePercent) : "—"}
        loading={loading}
      />
      <ReportMetricCard label="Pending" value={summary?.pending ?? 0} loading={loading} />
      <ReportMetricCard label="Filled" value={summary?.filled ?? 0} loading={loading} tone="success" />
      <ReportMetricCard label="Completed" value={summary?.completed ?? 0} loading={loading} />
      <ReportMetricCard label="Cancelled" value={summary?.cancelled ?? 0} loading={loading} tone="warning" />
      <ReportMetricCard
        label="Scheduled Hours"
        value={ready ? formatReportDurationMinutes(summary!.totalScheduledMinutes) : "—"}
        loading={loading}
      />
      <ReportMetricCard
        label={REPORT_SCHEDULED_HOURS_LABEL}
        value={
          ready ? formatReportDurationMinutes(summary!.totalCompletedScheduledMinutes) : "—"
        }
        loading={loading}
      />
    </ReportMetricGrid>
  );
}

export function CentreUsageSummarySkeleton() {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading />
      ))}
    </ReportMetricGrid>
  );
}
