import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { centresApi } from "@/lib/db";
import { formatOpsDateToronto, formatReportFillRatePercent } from "@/lib/ops-report-formatters";
import { defaultReportSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  centreId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/shift-fulfillment")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ShiftFulfillmentReport,
});

function ShiftFulfillmentReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const defaults = defaultReportSearch();

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      centreId: search.centreId ?? "all",
    }),
    [search, defaults.dateFrom, defaults.dateTo],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [centreId, setCentreId] = useState(applied.centreId);

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const reportQ = useQuery({
    queryKey: ["reports-shift-fulfillment", applied.dateFrom, applied.dateTo, applied.centreId],
    queryFn: () =>
      reportsApi.shiftFulfillment({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        centreId: applied.centreId === "all" ? undefined : applied.centreId,
      }),
  });

  function applyFilters() {
    navigate({
      search: {
        dateFrom,
        dateTo,
        centreId: centreId === "all" ? undefined : centreId,
      },
    });
  }

  function resetFilters() {
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setCentreId("all");
    navigate({ search: {} });
  }

  const summary = reportQ.data?.summary;
  const rangeLabel = reportQ.data
    ? `${formatOpsDateToronto(reportQ.data.dateFrom)} – ${formatOpsDateToronto(reportQ.data.dateTo)}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Fulfillment"
        subtitle="Filled, completed, pending, and cancelled shifts for the selected period."
        actions={
          <Link
            to="/reports"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All reports
          </Link>
        }
      />

      <ReportFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        centreId={centreId}
        centres={centresQ.data ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onCentreChange={setCentreId}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {rangeLabel && (
        <p className="text-sm text-muted-foreground">
          Showing {rangeLabel}
          {reportQ.data?.centreName ? ` · ${reportQ.data.centreName}` : ""}
        </p>
      )}

      {reportQ.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load this report. Adjust filters and try again.
          </CardContent>
        </Card>
      )}

      <ReportMetricGrid>
        <ReportMetricCard
          label="Total Shifts"
          value={summary?.total ?? 0}
          loading={reportQ.isLoading}
          tone="primary"
        />
        <ReportMetricCard
          label="Fill Rate"
          value={formatReportFillRatePercent(summary?.fillRatePercent ?? null)}
          loading={reportQ.isLoading}
          tone="success"
        />
        <ReportMetricCard
          label="Pending"
          value={summary?.pending ?? 0}
          loading={reportQ.isLoading}
          tone="warning"
        />
        <ReportMetricCard
          label="Filled"
          value={summary?.filled ?? 0}
          loading={reportQ.isLoading}
        />
        <ReportMetricCard
          label="Completed"
          value={summary?.completed ?? 0}
          loading={reportQ.isLoading}
        />
        <ReportMetricCard
          label="Cancelled"
          value={summary?.cancelled ?? 0}
          loading={reportQ.isLoading}
          tone="muted"
        />
      </ReportMetricGrid>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reportQ.isLoading &&
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          {!reportQ.isLoading && summary && summary.total === 0 && (
            <p className="text-sm text-muted-foreground">No shifts were found for this period.</p>
          )}
          {!reportQ.isLoading && summary && summary.total > 0 && (
            <div className="space-y-2">
              {[
                ["Pending", summary.pending],
                ["Filled", summary.filled],
                ["Completed", summary.completed],
                ["Cancelled", summary.cancelled],
              ].map(([label, count]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <span>{label}</span>
                  <span className="font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
