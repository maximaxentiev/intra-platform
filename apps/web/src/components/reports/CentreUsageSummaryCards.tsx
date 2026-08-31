import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import {
  formatReportDurationMinutes,
  formatReportFillRatePercent,
} from "@/lib/ops-report-formatters";
import type { CentreUsageSummary } from "@/lib/reports-types";
import {
  REPORT_COMPLETED_HOURS_LABEL,
  REPORT_TOTAL_HOURS_LABEL,
} from "@/lib/reports-types";

export function CentreUsageSummaryCards({
  summary,
  loading,
  ready,
}: {
  summary: CentreUsageSummary | undefined;
  loading: boolean;
  ready: boolean;
}) {
  const cancelledHours =
    ready && summary
      ? formatReportDurationMinutes(summary.cancelledScheduledMinutes)
      : "—";

  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      <ReportMetricCard
        label="Centres Shown"
        value={summary?.totalCentres ?? 0}
        loading={loading}
        plainLabel
      />
      <ReportMetricCard
        label="Total Shifts"
        value={summary?.totalShifts ?? 0}
        loading={loading}
        plainLabel
      />
      <ReportMetricCard
        label="Fill Rate"
        value={ready ? formatReportFillRatePercent(summary!.fillRatePercent) : "—"}
        loading={loading}
        plainLabel
      />
      <ReportMetricCard label="Pending" value={summary?.pending ?? 0} loading={loading} plainLabel />
      <ReportMetricCard label="Filled" value={summary?.filled ?? 0} loading={loading} plainLabel />
      <ReportMetricCard label="Completed" value={summary?.completed ?? 0} loading={loading} plainLabel />
      <ReportMetricCard
        label="Cancelled"
        value={ready ? `${summary!.cancelled} · ${cancelledHours}` : "—"}
        loading={loading}
        plainLabel
      />
      <ReportMetricCard
        label={REPORT_TOTAL_HOURS_LABEL}
        value={ready ? formatReportDurationMinutes(summary!.totalScheduledMinutes) : "—"}
        loading={loading}
        plainLabel
      />
      <ReportMetricCard
        label={REPORT_COMPLETED_HOURS_LABEL}
        value={
          ready ? formatReportDurationMinutes(summary!.totalCompletedScheduledMinutes) : "—"
        }
        loading={loading}
        plainLabel
      />
    </ReportMetricGrid>
  );
}

export function CentreUsageSummarySkeleton() {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading plainLabel />
      ))}
    </ReportMetricGrid>
  );
}
