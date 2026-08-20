import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import { formatReportFillRatePercent } from "@/lib/ops-report-formatters";
import type { ShiftFulfillmentSummary } from "@/lib/reports-types";

export function ShiftFulfillmentSummaryCards({
  summary,
  loading,
  ready,
  singleCentre,
}: {
  summary: ShiftFulfillmentSummary | undefined;
  loading: boolean;
  ready: boolean;
  singleCentre: boolean;
}) {
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {!singleCentre ? (
        <ReportMetricCard label="Centres Shown" value={summary?.totalCentres ?? 0} loading={loading} />
      ) : null}
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
        tone="success"
      />
      <ReportMetricCard label="Pending" value={summary?.pending ?? 0} loading={loading} tone="warning" />
      <ReportMetricCard label="Filled" value={summary?.filled ?? 0} loading={loading} />
      <ReportMetricCard label="Completed" value={summary?.completed ?? 0} loading={loading} />
      <ReportMetricCard label="Cancelled" value={summary?.cancelled ?? 0} loading={loading} tone="muted" />
    </ReportMetricGrid>
  );
}

export function ShiftFulfillmentSummarySkeleton({ singleCentre }: { singleCentre: boolean }) {
  const count = singleCentre ? 6 : 7;
  return (
    <ReportMetricGrid className="sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading />
      ))}
    </ReportMetricGrid>
  );
}
