import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ReportMetricCard, ReportMetricGrid } from "@/components/reports/ReportMetricCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centresApi } from "@/lib/db";
import {
  formatOpsDateToronto,
  formatReportDurationMinutes,
  formatReportFillRatePercent,
} from "@/lib/ops-report-formatters";
import { defaultReportSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import { REPORT_SCHEDULED_HOURS_LABEL } from "@/lib/reports-types";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  centreId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/centre-usage")({
  validateSearch: (search) => searchSchema.parse(search),
  component: CentreUsageReport,
});

function CentreUsageReport() {
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
    queryKey: ["reports-centre-usage", applied.dateFrom, applied.dateTo, applied.centreId],
    queryFn: () =>
      reportsApi.centreUsage({
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
  const rows = reportQ.data?.rows ?? [];
  const reportReady = !reportQ.isLoading && summary != null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centre Usage"
        subtitle="Shift volume and scheduled hours by Centre."
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

      {reportQ.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load this report. Adjust filters and try again.
          </CardContent>
        </Card>
      )}

      <ReportMetricGrid>
        <ReportMetricCard
          label="Centres shown"
          value={summary?.totalCentres ?? 0}
          loading={reportQ.isLoading}
        />
        <ReportMetricCard
          label="Total Shifts"
          value={summary?.totalShifts ?? 0}
          loading={reportQ.isLoading}
          tone="primary"
        />
        <ReportMetricCard
          label="Scheduled Hours"
          value={
            reportReady
              ? formatReportDurationMinutes(summary.totalScheduledMinutes)
              : "—"
          }
          loading={reportQ.isLoading}
        />
        <ReportMetricCard
          label={REPORT_SCHEDULED_HOURS_LABEL}
          value={
            reportReady
              ? formatReportDurationMinutes(summary.totalCompletedScheduledMinutes)
              : "—"
          }
          loading={reportQ.isLoading}
        />
      </ReportMetricGrid>

      {reportQ.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {!reportQ.isLoading && rows.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No shifts were found for this period.
          </CardContent>
        </Card>
      )}

      {!reportQ.isLoading && rows.length > 0 && (
        <>
          <div className="hidden lg:block">
            <Card className="border-border/70 shadow-xs overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Centre</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Fill Rate</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Filled</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Cancelled</TableHead>
                    <TableHead className="text-right">Scheduled</TableHead>
                    <TableHead className="text-right">Completed Scheduled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.centreId}>
                      <TableCell className="font-medium">{row.centreName}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.totalShifts}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatReportFillRatePercent(row.fillRatePercent)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.pending}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.filled}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.cancelled}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatReportDurationMinutes(row.totalScheduledMinutes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatReportDurationMinutes(row.completedScheduledMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Card key={row.centreId} className="border-border/70 shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <div className="font-medium">{row.centreName}</div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      <span>
                        Total Shifts: <strong className="tabular-nums">{row.totalShifts}</strong>
                      </span>
                      <span>
                        Fill Rate:{" "}
                        <strong className="tabular-nums">
                          {formatReportFillRatePercent(row.fillRatePercent)}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Pending: {row.pending}</span>
                    <span>Filled: {row.filled}</span>
                    <span>Completed: {row.completed}</span>
                    <span>Cancelled: {row.cancelled}</span>
                  </div>
                  <div className="text-sm">
                    <div>
                      Scheduled: {formatReportDurationMinutes(row.totalScheduledMinutes)}
                    </div>
                    <div>
                      Completed Scheduled:{" "}
                      {formatReportDurationMinutes(row.completedScheduledMinutes)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
