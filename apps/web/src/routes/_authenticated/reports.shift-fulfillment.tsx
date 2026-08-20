import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  EMPTY_SHIFT_FULFILLMENT_ADVANCED,
  ShiftFulfillmentFilters,
  type ShiftFulfillmentAdvancedFilters,
} from "@/components/reports/ShiftFulfillmentFilters";
import {
  ShiftFulfillmentSummaryCards,
  ShiftFulfillmentSummarySkeleton,
} from "@/components/reports/ShiftFulfillmentSummaryCards";
import { ReportPagination } from "@/components/reports/ReportPagination";
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
import { formatReportFillRatePercent } from "@/lib/ops-report-formatters";
import {
  buildCentreMetricFilterChips,
  centreMetricFiltersToApiQuery,
  centreMetricFiltersToSearchParams,
  clearCentreMetricFilterKey,
  EMPTY_CENTRE_METRIC_FILTERS,
  parseCentreMetricFiltersFromSearch,
} from "@/lib/report-centre-metric-filters";
import {
  REPORT_COMPARISON_DEFAULT_PAGE_SIZE,
  resolveReportComparisonPageSize,
  type ReportComparisonPageSize,
} from "@/lib/report-pagination-labels";
import { defaultReportSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import {
  centreSelectionToApiQuery,
  centreSelectionToSearchParams,
  isSingleCentreSelection,
  resolveAppliedCentreSelection,
  type CentreSelectionState,
} from "@/lib/reports-centre-selection";

const metricFilterSchema = {
  totalShiftsMin: z.string().optional(),
  totalShiftsMax: z.string().optional(),
  fillRateMin: z.string().optional(),
  fillRateMax: z.string().optional(),
  pendingMin: z.string().optional(),
  pendingMax: z.string().optional(),
  filledMin: z.string().optional(),
  filledMax: z.string().optional(),
  completedMin: z.string().optional(),
  completedMax: z.string().optional(),
  cancelledMin: z.string().optional(),
  cancelledMax: z.string().optional(),
};

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  centreIds: z.string().optional(),
  centreId: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  ...metricFilterSchema,
});

export const Route = createFileRoute("/_authenticated/reports/shift-fulfillment")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ShiftFulfillmentReport,
});

function ShiftFulfillmentReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const defaults = defaultReportSearch();

  const appliedSelection = useMemo(() => resolveAppliedCentreSelection(search), [search]);
  const appliedMetricFilters = useMemo(() => parseCentreMetricFiltersFromSearch(search), [search]);

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      selection: appliedSelection,
      metricFilters: appliedMetricFilters,
      page: search.page && search.page > 0 ? search.page : 1,
      pageSize: resolveReportComparisonPageSize(search.pageSize),
    }),
    [search, defaults.dateFrom, defaults.dateTo, appliedSelection, appliedMetricFilters],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [selection, setSelection] = useState<CentreSelectionState>(applied.selection);
  const [advanced, setAdvanced] = useState<ShiftFulfillmentAdvancedFilters>({
    ...EMPTY_SHIFT_FULFILLMENT_ADVANCED,
    ...applied.metricFilters,
  });

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-shift-fulfillment",
      applied.dateFrom,
      applied.dateTo,
      applied.selection.mode,
      applied.selection.centreIds.join(","),
      JSON.stringify(applied.metricFilters),
      applied.page,
      applied.pageSize,
    ],
    queryFn: () =>
      reportsApi.shiftFulfillment({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...centreSelectionToApiQuery(applied.selection),
        ...centreMetricFiltersToApiQuery(applied.metricFilters),
        page: applied.page,
        pageSize: applied.pageSize,
      }),
  });

  function buildSearch(page: number, pageSize: ReportComparisonPageSize) {
    return {
      dateFrom: dateFrom === defaults.dateFrom ? undefined : dateFrom,
      dateTo: dateTo === defaults.dateTo ? undefined : dateTo,
      ...centreSelectionToSearchParams(selection),
      ...centreMetricFiltersToSearchParams(advanced),
      page: page === 1 ? undefined : page,
      pageSize: pageSize === REPORT_COMPARISON_DEFAULT_PAGE_SIZE ? undefined : pageSize,
    };
  }

  function applyFilters() {
    navigate({ search: buildSearch(1, applied.pageSize) });
  }

  function resetFilters() {
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setSelection({ mode: "all", centreIds: [] });
    setAdvanced(EMPTY_SHIFT_FULFILLMENT_ADVANCED);
    navigate({ search: {} });
  }

  function clearAdvancedFilters() {
    setAdvanced(EMPTY_SHIFT_FULFILLMENT_ADVANCED);
    navigate({
      search: buildSearch(1, applied.pageSize),
    });
  }

  const summary = reportQ.data?.summary;
  const rows = reportQ.data?.rows ?? [];
  const reportReady = !reportQ.isLoading && summary != null;
  const singleCentreSelected = isSingleCentreSelection(applied.selection);
  const showComparison = !singleCentreSelected;
  const selectedCentreName =
    singleCentreSelected && reportQ.data?.centreName ? reportQ.data.centreName : null;
  const filteredOutSingleCentre =
    singleCentreSelected && reportReady && rows.length === 0 && summary.totalCentres === 0;

  const chipDefs = buildCentreMetricFilterChips(applied.metricFilters).filter(
    (chip) => !chip.id.includes("scheduled"),
  );
  const activeAdvancedChips = chipDefs.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => {
      const next = clearCentreMetricFilterKey(advanced, chip.key);
      setAdvanced({ ...EMPTY_SHIFT_FULFILLMENT_ADVANCED, ...next });
      navigate({ search: buildSearch(1, applied.pageSize) });
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift Fulfillment"
        subtitle="Filled, completed, pending, and cancelled shifts by Centre."
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
          Showing results for{" "}
          <span className="font-medium text-foreground">{selectedCentreName}</span>
        </p>
      )}

      <ShiftFulfillmentFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        centres={centresQ.data ?? []}
        selection={selection}
        advanced={advanced}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSelectionChange={setSelection}
        onAdvancedChange={setAdvanced}
        onApply={applyFilters}
        onReset={resetFilters}
        activeAdvancedChips={activeAdvancedChips}
        onClearAdvanced={activeAdvancedChips.length > 0 ? clearAdvancedFilters : undefined}
      />

      {reportQ.isError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load this report. Adjust filters and try again.
          </CardContent>
        </Card>
      )}

      {filteredOutSingleCentre && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            The selected Centre does not match the current filters.
          </CardContent>
        </Card>
      )}

      {!filteredOutSingleCentre && (
        <>
          {reportQ.isLoading ? (
            <ShiftFulfillmentSummarySkeleton singleCentre={singleCentreSelected} />
          ) : (
            <ShiftFulfillmentSummaryCards
              summary={summary}
              loading={false}
              ready={reportReady}
              singleCentre={singleCentreSelected}
            />
          )}

          {reportQ.isLoading && showComparison && (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-lg" />
              ))}
            </div>
          )}

          {!reportQ.isLoading && showComparison && reportQ.data && (
            <>
              <ReportPagination
                page={reportQ.data.page}
                pageSize={resolveReportComparisonPageSize(reportQ.data.pageSize)}
                totalCount={reportQ.data.totalCount}
                hasMore={reportQ.data.hasMore}
                entityLabel="centres"
                onPageChange={(page) => navigate({ search: buildSearch(page, applied.pageSize) })}
                onPageSizeChange={(pageSize) => navigate({ search: buildSearch(1, pageSize) })}
              />

              {rows.length > 0 && (
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
                          <div className="font-medium">{row.centreName}</div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <span>
                              Total: <strong className="tabular-nums">{row.totalShifts}</strong>
                            </span>
                            <span>
                              Fill Rate:{" "}
                              <strong className="tabular-nums">
                                {formatReportFillRatePercent(row.fillRatePercent)}
                              </strong>
                            </span>
                            <span>Pending: {row.pending}</span>
                            <span>Filled: {row.filled}</span>
                            <span>Completed: {row.completed}</span>
                            <span>Cancelled: {row.cancelled}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {rows.length === 0 && reportReady && (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    No centres match the current filters.
                  </CardContent>
                </Card>
              )}

              <ReportPagination
                page={reportQ.data.page}
                pageSize={resolveReportComparisonPageSize(reportQ.data.pageSize)}
                totalCount={reportQ.data.totalCount}
                hasMore={reportQ.data.hasMore}
                entityLabel="centres"
                onPageChange={(page) => navigate({ search: buildSearch(page, applied.pageSize) })}
                onPageSizeChange={(pageSize) => navigate({ search: buildSearch(1, pageSize) })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
