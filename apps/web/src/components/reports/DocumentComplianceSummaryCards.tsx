import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import type { DocumentComplianceSummary } from "@/lib/reports-types";

export function DocumentComplianceSummarySkeleton() {
  return (
    <ReportMetricGrid className="xl:grid-cols-4 2xl:grid-cols-7">
      {Array.from({ length: 7 }).map((_, index) => (
        <ReportMetricCard key={index} label="Loading" value="—" loading />
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
    { label: "Staff Shown", value: summary?.staffShown ?? 0, tone: "default" as const },
    { label: "Compliant", value: summary?.compliant ?? 0, tone: "success" as const },
    { label: "Expiring Soon", value: summary?.expiringSoon ?? 0, tone: "warning" as const },
    { label: "Needs Attention", value: summary?.needsAttention ?? 0, tone: "primary" as const },
    { label: "Pending Review", value: summary?.pendingReview ?? 0, tone: "default" as const },
    { label: "Issue Flagged", value: summary?.issueFlagged ?? 0, tone: "default" as const },
    { label: "Expired", value: summary?.expired ?? 0, tone: "default" as const },
  ];

  return (
    <ReportMetricGrid className="xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <ReportMetricCard
          key={card.label}
          label={card.label}
          value={ready ? card.value : "—"}
          loading={loading}
          tone={card.tone}
        />
      ))}
    </ReportMetricGrid>
  );
}
