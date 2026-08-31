import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/ui-kit";
import { StaffUsageFilters } from "@/components/reports/StaffUsageFilters";
import {
  StaffUsageSummaryCards,
  StaffUsageSummarySkeleton,
} from "@/components/reports/StaffUsageSummaryCards";
import { ReportPagination } from "@/components/reports/ReportPagination";
import { ReportExportButton } from "@/components/reports/ReportExportButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtTime, staffApi } from "@/lib/db";
import {
  formatOpsDateToronto,
  formatReportDurationMinutes,
} from "@/lib/ops-report-formatters";
import { defaultReportSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import { reportExportPaths } from "@/lib/report-export";
import {
  parseOptionalCountInput,
} from "@/lib/report-hours-filter";
import {
  rulesFromStaffUsageSearch,
  staffUsageMetricSearchFromApplied,
  staffUsageSearchFromRules,
  staffUsageSearchToSearchParams,
  STAFF_USAGE_METRICS,
  validateReportFilterRules,
  type ReportFilterRule,
} from "@/lib/report-filter-rules";
import {
  REPORT_COMPARISON_DEFAULT_PAGE_SIZE,
  resolveReportComparisonPageSize,
  STAFF_USAGE_SHIFT_DETAIL_PAGE_SIZE_OPTIONS,
  resolveStaffUsageShiftDetailPageSize,
  type ReportComparisonPageSize,
} from "@/lib/report-pagination-labels";
import {
  isSingleStaffSelection,
  resolveAppliedStaffSelection,
  staffSelectionToApiQuery,
  staffSelectionToSearchParams,
  type StaffSelectionState,
} from "@/lib/reports-staff-selection";
import {
  REPORT_SCHEDULED_HOURS_LABEL,
  REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL,
} from "@/lib/reports-types";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  staffIds: z.string().optional(),
  staffId: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
  roles: z.string().optional(),
  completedShiftsMin: z.string().optional(),
  completedShiftsMax: z.string().optional(),
  completedScheduledHoursMin: z.string().optional(),
  completedScheduledHoursMax: z.string().optional(),
  filledShiftsMin: z.string().optional(),
  filledShiftsMax: z.string().optional(),
  filledScheduledHoursMin: z.string().optional(),
  filledScheduledHoursMax: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/staff-usage")({
  validateSearch: (search) => searchSchema.parse(search),
  component: StaffUsageReport,
});

function formatShiftTimeRange(startTime: string, endTime: string): string {
  return `${fmtTime(startTime)} – ${fmtTime(endTime)}`;
}

function StaffUsageReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const defaults = defaultReportSearch();

  const appliedSelection = useMemo(() => resolveAppliedStaffSelection(search), [search]);

  const appliedMetricSearch = useMemo(
    () => staffUsageMetricSearchFromApplied(search),
    [search],
  );

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      selection: appliedSelection,
      metricSearch: appliedMetricSearch,
      page: search.page && search.page > 0 ? search.page : 1,
      pageSize: resolveReportComparisonPageSize(search.pageSize),
    }),
    [search, defaults.dateFrom, defaults.dateTo, appliedSelection, appliedMetricSearch],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [selection, setSelection] = useState<StaffSelectionState>(applied.selection);
  const [rules, setRules] = useState<ReportFilterRule[]>(() =>
    rulesFromStaffUsageSearch(applied.metricSearch),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [drillDownPage, setDrillDownPage] = useState(1);
  const [drillDownPageSize, setDrillDownPageSize] = useState(10);

  const staffQ = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-staff-usage",
      applied.dateFrom,
      applied.dateTo,
      applied.selection.mode,
      applied.selection.staffIds.join(","),
      JSON.stringify(applied.metricSearch),
      applied.page,
      applied.pageSize,
    ],
    queryFn: () =>
      reportsApi.staffUsage({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...staffSelectionToApiQuery(applied.selection),
        roles: applied.metricSearch.roles.length ? applied.metricSearch.roles : undefined,
        completedShiftsMin: parseOptionalCountInput(applied.metricSearch.completedShiftsMin),
        completedShiftsMax: parseOptionalCountInput(applied.metricSearch.completedShiftsMax),
        completedScheduledHoursMin: applied.metricSearch.completedScheduledHoursMin
          ? Number(applied.metricSearch.completedScheduledHoursMin)
          : undefined,
        completedScheduledHoursMax: applied.metricSearch.completedScheduledHoursMax
          ? Number(applied.metricSearch.completedScheduledHoursMax)
          : undefined,
        filledShiftsMin: parseOptionalCountInput(applied.metricSearch.filledShiftsMin),
        filledShiftsMax: parseOptionalCountInput(applied.metricSearch.filledShiftsMax),
        filledScheduledHoursMin: applied.metricSearch.filledScheduledHoursMin
          ? Number(applied.metricSearch.filledScheduledHoursMin)
          : undefined,
        filledScheduledHoursMax: applied.metricSearch.filledScheduledHoursMax
          ? Number(applied.metricSearch.filledScheduledHoursMax)
          : undefined,
        page: applied.page,
        pageSize: applied.pageSize,
      }),
  });

  function buildSearch(page: number, pageSize: ReportComparisonPageSize, nextRules = rules) {
    const metricSearch = staffUsageSearchFromRules(nextRules);
    return {
      dateFrom: dateFrom === defaults.dateFrom ? undefined : dateFrom,
      dateTo: dateTo === defaults.dateTo ? undefined : dateTo,
      ...staffSelectionToSearchParams(selection),
      ...staffUsageSearchToSearchParams(metricSearch),
      page: page === 1 ? undefined : page,
      pageSize: pageSize === REPORT_COMPARISON_DEFAULT_PAGE_SIZE ? undefined : pageSize,
    };
  }

  const singleStaffSelected = isSingleStaffSelection(applied.selection);
  const selectedStaffId = singleStaffSelected ? applied.selection.staffIds[0] : undefined;

  const drillDownQ = useQuery({
    enabled: Boolean(selectedStaffId),
    queryKey: [
      "reports-staff-usage-shifts",
      selectedStaffId,
      applied.dateFrom,
      applied.dateTo,
      drillDownPage,
      drillDownPageSize,
    ],
    queryFn: () =>
      reportsApi.staffUsageShifts(selectedStaffId!, {
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        page: drillDownPage,
        pageSize: drillDownPageSize,
      }),
  });

  function applyFilters() {
    const error = validateReportFilterRules(rules, STAFF_USAGE_METRICS);
    setValidationError(error);
    if (error) return;
    setDrillDownPage(1);
    navigate({ search: buildSearch(1, applied.pageSize) });
  }

  function resetFilters() {
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setSelection({ mode: "all", staffIds: [] });
    setRules([]);
    setValidationError(null);
    setDrillDownPage(1);
    navigate({ search: {} });
  }

  function clearDataFilters() {
    setRules([]);
    setValidationError(null);
  }

  function viewStaffDetails(staffId: string) {
    setDrillDownPage(1);
    setDrillDownPageSize(10);
    navigate({
      search: {
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        staffIds: staffId,
      },
    });
  }

  const summary = reportQ.data?.summary;
  const rows = reportQ.data?.rows ?? [];
  const reportReady = !reportQ.isLoading && summary != null;
  const showComparison = !singleStaffSelected;
  const selectedStaffName =
    singleStaffSelected && rows[0] ? rows[0].staffName : null;
  const noUsageInPeriod =
    reportReady && summary.completedShifts === 0 && summary.filledShifts === 0;

  return (
    <div className="space-y-6">
      <BackLink to="/reports" label="All reports" />

      <PageHeader
        title="Staff Usage"
        subtitle="Review completed and upcoming shift usage by Staff member."
        actions={
          <>
            <ReportExportButton
              exportPath={reportExportPaths.staffUsage}
              query={{
                dateFrom: applied.dateFrom,
                dateTo: applied.dateTo,
                ...staffSelectionToApiQuery(applied.selection),
                ...staffUsageSearchToSearchParams(applied.metricSearch),
              }}
              ready={reportReady}
              totalCount={reportQ.data?.totalCount}
            />
          </>
        }
      />

      {selectedStaffName && (
        <p className="text-sm text-muted-foreground">
          Showing results for{" "}
          <span className="font-medium text-foreground">{selectedStaffName}</span>
        </p>
      )}

      <StaffUsageFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        staffMembers={staffQ.data ?? []}
        selection={selection}
        rules={rules}
        validationError={validationError}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSelectionChange={setSelection}
        onRulesChange={(nextRules) => {
          setRules(nextRules);
          setValidationError(validateReportFilterRules(nextRules, STAFF_USAGE_METRICS));
        }}
        onClearRules={clearDataFilters}
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
        <StaffUsageSummarySkeleton />
      ) : (
        <StaffUsageSummaryCards summary={summary} loading={false} ready={reportReady} />
      )}

      {noUsageInPeriod && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            No completed or filled shifts were found for this period.
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

      {!reportQ.isLoading && showComparison && reportQ.data && (
        <>
          <ReportPagination
            page={reportQ.data.page}
            pageSize={resolveReportComparisonPageSize(reportQ.data.pageSize)}
            totalCount={reportQ.data.totalCount}
            hasMore={reportQ.data.hasMore}
            entityLabel="staff"
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
                    <TableHead>Staff</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Completed Scheduled</TableHead>
                    <TableHead className="text-right">Filled</TableHead>
                    <TableHead className="text-right">Filled Scheduled</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.staffId}>
                      <TableCell className="font-medium">{row.staffName}</TableCell>
                      <TableCell>{row.role}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.completedShifts}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatReportDurationMinutes(row.completedScheduledMinutes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.filledShifts}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatReportDurationMinutes(row.filledScheduledMinutes)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => viewStaffDetails(row.staffId)}
                        >
                          View details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div className="space-y-3 lg:hidden">
            {rows.map((row) => (
              <Card key={row.staffId} className="border-border/70 shadow-xs">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <div className="font-medium">{row.staffName}</div>
                    <div className="text-sm text-muted-foreground">Role: {row.role}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span>
                      Completed: <strong className="tabular-nums">{row.completedShifts}</strong>
                    </span>
                    <span>
                      {REPORT_SCHEDULED_HOURS_LABEL}:{" "}
                      <strong className="tabular-nums">
                        {formatReportDurationMinutes(row.completedScheduledMinutes)}
                      </strong>
                    </span>
                    <span>
                      Filled: <strong className="tabular-nums">{row.filledShifts}</strong>
                    </span>
                    <span>
                      {REPORT_SCHEDULED_HOURS_ON_FILLED_SHIFTS_LABEL}:{" "}
                      <strong className="tabular-nums">
                        {formatReportDurationMinutes(row.filledScheduledMinutes)}
                      </strong>
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => viewStaffDetails(row.staffId)}
                  >
                    View details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          </>
          )}

          <ReportPagination
            page={reportQ.data.page}
            pageSize={resolveReportComparisonPageSize(reportQ.data.pageSize)}
            totalCount={reportQ.data.totalCount}
            hasMore={reportQ.data.hasMore}
            entityLabel="staff"
            onPageChange={(page) => navigate({ search: buildSearch(page, applied.pageSize) })}
            onPageSizeChange={(pageSize) => navigate({ search: buildSearch(1, pageSize) })}
          />
        </>
      )}

      {singleStaffSelected && selectedStaffId && (
        <Card className="border-border/70 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Completed Shifts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {drillDownQ.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 rounded-lg" />
                ))}
              </div>
            )}

            {drillDownQ.isError && (
              <p className="text-sm text-destructive">
                Could not load completed shifts for this Staff member.
              </p>
            )}

            {!drillDownQ.isLoading && drillDownQ.data && drillDownQ.data.items.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No completed shifts were found for this Staff member in the selected period.
              </p>
            )}

            {!drillDownQ.isLoading && drillDownQ.data && drillDownQ.data.items.length > 0 && (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Scheduled Time</TableHead>
                        <TableHead className="text-right">Scheduled Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drillDownQ.data.items.map((shift) => (
                        <TableRow key={shift.shiftId}>
                          <TableCell>{formatOpsDateToronto(shift.shiftDate)}</TableCell>
                          <TableCell>{shift.centreName}</TableCell>
                          <TableCell>{shift.role}</TableCell>
                          <TableCell>
                            {formatShiftTimeRange(
                              shift.scheduledStartTime,
                              shift.scheduledEndTime,
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatReportDurationMinutes(shift.scheduledMinutes)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-3 md:hidden">
                  {drillDownQ.data.items.map((shift) => (
                    <Card key={shift.shiftId} className="border-border/60">
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="font-medium">{formatOpsDateToronto(shift.shiftDate)}</div>
                        <div>{shift.centreName}</div>
                        <div className="text-muted-foreground">Role: {shift.role}</div>
                        <div>
                          Scheduled:{" "}
                          {formatShiftTimeRange(shift.scheduledStartTime, shift.scheduledEndTime)}
                        </div>
                        <div>
                          Duration: {formatReportDurationMinutes(shift.scheduledMinutes)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <ReportPagination
                  page={drillDownQ.data.page}
                  pageSize={resolveStaffUsageShiftDetailPageSize(drillDownQ.data.pageSize)}
                  totalCount={drillDownQ.data.totalCount}
                  hasMore={drillDownQ.data.hasMore}
                  entityLabel="shifts"
                  pageSizeOptions={STAFF_USAGE_SHIFT_DETAIL_PAGE_SIZE_OPTIONS}
                  onPageChange={setDrillDownPage}
                  onPageSizeChange={(size) => {
                    setDrillDownPageSize(size);
                    setDrillDownPage(1);
                  }}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
