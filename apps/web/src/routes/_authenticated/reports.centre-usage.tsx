import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { CentreUsageFilters } from "@/components/reports/CentreUsageFilters";
import {
  CentreUsageSummaryCards,
  CentreUsageSummarySkeleton,
} from "@/components/reports/CentreUsageSummaryCards";
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
  formatReportDurationMinutes,
  formatReportFillRatePercent,
} from "@/lib/ops-report-formatters";
import { defaultReportSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import {
  centreSelectionToApiQuery,
  centreSelectionToSearchParams,
  isSingleCentreSelection,
  resolveAppliedCentreSelection,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  centreIds: z.string().optional(),
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

  const appliedSelection = useMemo(() => resolveAppliedCentreSelection(search), [search]);

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      selection: appliedSelection,
    }),
    [search, defaults.dateFrom, defaults.dateTo, appliedSelection],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [selection, setSelection] = useState<CentreSelectionState>(applied.selection);

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-centre-usage",
      applied.dateFrom,
      applied.dateTo,
      applied.selection.mode,
      applied.selection.centreIds.join(","),
    ],
    queryFn: () =>
      reportsApi.centreUsage({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...centreSelectionToApiQuery(applied.selection),
      }),
  });

  function applyFilters() {
    navigate({
      search: {
        dateFrom,
        dateTo,
        ...centreSelectionToSearchParams(selection),
      },
    });
  }

  function resetFilters() {
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setSelection({ mode: "all", centreIds: [] });
    navigate({ search: {} });
  }

  const summary = reportQ.data?.summary;
  const rows = reportQ.data?.rows ?? [];
  const reportReady = !reportQ.isLoading && summary != null;
  const singleCentreSelected = isSingleCentreSelection(applied.selection);
  const showComparison = !singleCentreSelected;
  const selectedCentreName =
    singleCentreSelected && rows[0] ? rows[0].centreName : null;
  const noShiftsInPeriod = reportReady && summary.totalShifts === 0;

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

      {selectedCentreName && (
        <p className="text-sm text-muted-foreground">
          Showing results for <span className="font-medium text-foreground">{selectedCentreName}</span>
        </p>
      )}

      <CentreUsageFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        centres={centresQ.data ?? []}
        selection={selection}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSelectionChange={setSelection}
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

      {reportQ.isLoading ? (
        <CentreUsageSummarySkeleton />
      ) : (
        <CentreUsageSummaryCards summary={summary} loading={false} ready={reportReady} />
      )}

      {noShiftsInPeriod && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No shifts were found for the selected Centres and period.
          </CardContent>
        </Card>
      )}

      {reportQ.isLoading && showComparison && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {!reportQ.isLoading && showComparison && rows.length > 0 && (
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
