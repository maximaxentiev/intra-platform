import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import type { DocumentComplianceSummary } from "@/lib/reports-types";

export function DocumentComplianceSummarySkeleton() {
  return (
    <ReportMetricGrid className="xl:grid-cols-3 2xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading plainLabel />
      ))}
    </ReportMetricGrid>
  );
}

export function DocumentComplianceSummaryCards({
  summary,
  loading,
  ready,
}: {
  summary: DocumentComplianceSummary | undefined;
  loading: boolean;
  ready: boolean;
}) {
  const cards = [
    { label: "Staff Shown", value: summary?.staffShown ?? 0, plainLabel: true as const },
    { label: "Approved", value: summary?.compliant ?? 0, tone: "success" as const },
    { label: "Expiring Soon", value: summary?.expiringSoon ?? 0, tone: "warning" as const },
    { label: "Pending Review", value: summary?.pendingReview ?? 0, tone: "info" as const },
    { label: "Issue Flagged", value: summary?.issueFlagged ?? 0, plainLabel: true as const },
    { label: "Expired", value: summary?.expired ?? 0, tone: "destructive" as const },
  ];

  return (
    <ReportMetricGrid className="xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <ReportMetricCard
          key={card.label}
          label={card.label}
          value={ready ? card.value : "—"}
          loading={loading}
          plainLabel={"plainLabel" in card ? card.plainLabel : false}
          tone={"tone" in card ? card.tone : "default"}
        />
      ))}
    </ReportMetricGrid>
  );
}
