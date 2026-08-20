import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StaffUsageFilters } from "@/components/reports/StaffUsageFilters";
import {
  StaffUsageSummaryCards,
  StaffUsageSummarySkeleton,
} from "@/components/reports/StaffUsageSummaryCards";
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
  const [selection, setSelection] = useState<StaffSelectionState>(applied.selection);
  const [drillDownPage, setDrillDownPage] = useState(1);

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
    ],
    queryFn: () =>
      reportsApi.staffUsage({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        ...staffSelectionToApiQuery(applied.selection),
      }),
  });

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
    ],
    queryFn: () =>
      reportsApi.staffUsageShifts(selectedStaffId!, {
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        page: drillDownPage,
        pageSize: 50,
      }),
  });

  function applyFilters() {
    setDrillDownPage(1);
    navigate({
      search: {
        dateFrom,
        dateTo,
        ...staffSelectionToSearchParams(selection),
      },
    });
  }

  function resetFilters() {
    const next = defaultReportSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setSelection({ mode: "all", staffIds: [] });
    setDrillDownPage(1);
    navigate({ search: {} });
  }

  function viewStaffDetails(staffId: string) {
    setDrillDownPage(1);
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
      <PageHeader
        title="Staff Usage"
        subtitle="Review completed and upcoming shift usage by Staff member."
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

      {!reportQ.isLoading && showComparison && rows.length > 0 && (
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

                {drillDownQ.data.totalCount > drillDownQ.data.pageSize && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Page {drillDownQ.data.page} · {drillDownQ.data.totalCount} completed shifts
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={drillDownPage <= 1}
                        onClick={() => setDrillDownPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!drillDownQ.data.hasMore}
                        onClick={() => setDrillDownPage((page) => page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
