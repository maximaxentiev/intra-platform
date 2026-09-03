import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ReportExportAudienceButton } from "@/components/reports/ReportExportAudienceButton";
import { ReportPagination } from "@/components/reports/ReportPagination";
import { ReportStaffMultiSelect } from "@/components/reports/StaffUsageFilters";
import {
  CENTRE_USAGE_SHIFT_DETAIL_STATUSES,
  shiftDetailStatusSummaryLabel,
  shiftDetailStaffIdsFromSelection,
  shiftDetailStaffSelection,
  type CentreUsageShiftDetailSearch,
  type CentreUsageShiftDetailStatus,
} from "@/lib/centre-usage-shift-detail";
import { fmtTime, type Staff } from "@/lib/db";
import {
  formatReportDurationMinutes,
  formatOpsDateToronto,
} from "@/lib/ops-report-formatters";
import { resolveReportComparisonPageSize, type ReportComparisonPageSize } from "@/lib/report-pagination-labels";
import { reportExportPaths } from "@/lib/report-export";
import { reportsApi } from "@/lib/reports-api";
import type { CentreUsageShiftRow } from "@/lib/reports-types";
import type { StaffSelectionState } from "@/lib/reports-staff-selection";

type CentreUsageShiftDetailProps = {
  dateFrom: string;
  dateTo: string;
  centreIds: string[];
  cities?: string[];
  singleCentreSelected: boolean;
  detail: CentreUsageShiftDetailSearch;
  staffMembers: Staff[];
  onDetailChange: (next: Partial<CentreUsageShiftDetailSearch>) => void;
};

function formatShiftTimeRange(startTime: string, endTime: string): string {
  return `${fmtTime(startTime)}–${fmtTime(endTime)}`;
}

function ShiftDetailSummary({
  status,
  totalShifts,
  totalScheduledMinutes,
  uniqueStaff,
}: {
  status: CentreUsageShiftDetailStatus;
  totalShifts: number;
  totalScheduledMinutes: number;
  uniqueStaff: number;
}) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      <span>
        <strong className="tabular-nums text-foreground">{totalShifts}</strong>{" "}
        {shiftDetailStatusSummaryLabel(status)}
      </span>
      <span>
        <strong className="tabular-nums text-foreground">
          {formatReportDurationMinutes(totalScheduledMinutes)}
        </strong>{" "}
        Scheduled Hours
      </span>
      <span>
        <strong className="tabular-nums text-foreground">{uniqueStaff}</strong> Staff Used
      </span>
    </div>
  );
}

function ShiftDetailDesktopRow({
  shift,
  showCentre,
}: {
  shift: CentreUsageShiftRow;
  showCentre: boolean;
}) {
  return (
    <TableRow>
      <TableCell>{formatOpsDateToronto(shift.shiftDate)}</TableCell>
      {showCentre ? <TableCell>{shift.centreName}</TableCell> : null}
      <TableCell>{shift.staffName}</TableCell>
      <TableCell>{shift.role}</TableCell>
      <TableCell>
        <StatusBadge status={shift.status} size="xs" />
      </TableCell>
      <TableCell>{formatShiftTimeRange(shift.startTime, shift.endTime)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {formatReportDurationMinutes(shift.scheduledMinutes)}
      </TableCell>
      <TableCell>
        <Link
          to="/shifts/$id"
          params={{ id: shift.shiftId }}
          className="text-sm font-medium text-primary hover:underline"
        >
          View Shift
        </Link>
      </TableCell>
    </TableRow>
  );
}

function ShiftDetailMobileCard({
  shift,
  showCentre,
}: {
  shift: CentreUsageShiftRow;
  showCentre: boolean;
}) {
  return (
    <Card className="border-border/70 shadow-xs">
      <CardContent className="space-y-2 p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium">{formatOpsDateToronto(shift.shiftDate)}</div>
          <StatusBadge status={shift.status} size="xs" />
        </div>
        {showCentre ? <div className="text-muted-foreground">{shift.centreName}</div> : null}
        <div>{shift.staffName}</div>
        <div className="text-muted-foreground">{shift.role}</div>
        <div>{formatShiftTimeRange(shift.startTime, shift.endTime)}</div>
        <div>
          Scheduled Hours:{" "}
          <strong className="tabular-nums">
            {formatReportDurationMinutes(shift.scheduledMinutes)}
          </strong>
        </div>
        <Link
          to="/shifts/$id"
          params={{ id: shift.shiftId }}
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          View Shift
        </Link>
      </CardContent>
    </Card>
  );
}

export function CentreUsageShiftDetail({
  dateFrom,
  dateTo,
  centreIds,
  cities,
  singleCentreSelected,
  detail,
  staffMembers,
  onDetailChange,
}: CentreUsageShiftDetailProps) {
  const staffSelection = shiftDetailStaffSelection(detail.shiftStaffIds);
  const showCentreColumn = !singleCentreSelected;

  const detailQ = useQuery({
    queryKey: [
      "reports-centre-usage-shifts",
      dateFrom,
      dateTo,
      centreIds.join(","),
      (cities ?? []).join(","),
      detail.shiftStatus,
      detail.shiftStaffIds.join(","),
      detail.shiftPage,
      detail.shiftPageSize,
    ],
    queryFn: () =>
      reportsApi.centreUsageShifts({
        dateFrom,
        dateTo,
        centreIds,
        cities,
        status: detail.shiftStatus === "completed" ? undefined : detail.shiftStatus,
        staffIds: detail.shiftStaffIds.length ? detail.shiftStaffIds : undefined,
        page: detail.shiftPage,
        pageSize: detail.shiftPageSize,
      }),
  });

  const detailReady = !detailQ.isLoading && detailQ.data != null;
  const rows = detailQ.data?.rows ?? [];
  const summary = detailQ.data?.summary;

  function updateStaffSelection(selection: StaffSelectionState) {
    onDetailChange({
      shiftStaffIds: shiftDetailStaffIdsFromSelection(selection),
      shiftPage: 1,
    });
  }

  function updateStatus(status: CentreUsageShiftDetailStatus) {
    onDetailChange({ shiftStatus: status, shiftPage: 1 });
  }

  function goToPage(page: number) {
    onDetailChange({ shiftPage: page });
  }

  function changePageSize(pageSize: ReportComparisonPageSize) {
    onDetailChange({ shiftPage: 1, shiftPageSize: pageSize });
  }

  const emptyMessage =
    detail.shiftStatus === "all"
      ? "No shifts were found for the selected Centres and period."
      : `No ${detail.shiftStatus} shifts were found for the selected Centres and period.`;

  return (
    <section className="space-y-4" aria-labelledby="centre-usage-shift-detail-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="centre-usage-shift-detail-heading" className="text-lg font-semibold">
            Shift Detail
          </h2>
          <p className="text-sm text-muted-foreground">
          </p>
        </div>
        <ReportExportAudienceButton
          exportPath={reportExportPaths.centreUsageShiftDetail}
          query={{
            dateFrom,
            dateTo,
            centreIds,
            cities,
            status: detail.shiftStatus === "completed" ? undefined : detail.shiftStatus,
            staffIds: detail.shiftStaffIds.length ? detail.shiftStaffIds : undefined,
          }}
          centreIds={centreIds}
          ready={detailReady}
          totalCount={detailQ.data?.totalCount}
          label="Export Shift Detail CSV"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-2xl">
        <div className="space-y-2">
          <Label htmlFor="shift-detail-status">Status</Label>
          <Select value={detail.shiftStatus} onValueChange={(value) => updateStatus(value as CentreUsageShiftDetailStatus)}>
            <SelectTrigger id="shift-detail-status" className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CENTRE_USAGE_SHIFT_DETAIL_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Staff</Label>
          <ReportStaffMultiSelect
            staffMembers={staffMembers}
            selection={staffSelection}
            onSelectionChange={updateStaffSelection}
          />
        </div>
      </div>

      {detailQ.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      ) : null}

      {detailQ.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Could not load shift detail.
          </CardContent>
        </Card>
      ) : null}

      {detailQ.data ? (
        <>
          <ShiftDetailSummary
            status={detail.shiftStatus}
            totalShifts={summary?.totalShifts ?? 0}
            totalScheduledMinutes={summary?.totalScheduledMinutes ?? 0}
            uniqueStaff={summary?.uniqueStaff ?? 0}
          />

          {detailQ.data.totalCount > 0 ? (
            <>
              <ReportPagination
                page={detailQ.data.page}
                pageSize={resolveReportComparisonPageSize(detailQ.data.pageSize)}
                totalCount={detailQ.data.totalCount}
                hasMore={detailQ.data.hasMore}
                entityLabel="shifts"
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />

              <div className="hidden lg:block">
                <Card className="border-border/70 shadow-xs overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        {showCentreColumn ? <TableHead>Centre</TableHead> : null}
                        <TableHead>Staff</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled Time</TableHead>
                        <TableHead className="text-right">Scheduled Hours</TableHead>
                        <TableHead>Shift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((shift) => (
                        <ShiftDetailDesktopRow
                          key={shift.shiftId}
                          shift={shift}
                          showCentre={showCentreColumn}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              <div className="space-y-3 lg:hidden">
                {rows.map((shift) => (
                  <ShiftDetailMobileCard key={shift.shiftId} shift={shift} showCentre={showCentreColumn} />
                ))}
              </div>

              <ReportPagination
                page={detailQ.data.page}
                pageSize={resolveReportComparisonPageSize(detailQ.data.pageSize)}
                totalCount={detailQ.data.totalCount}
                hasMore={detailQ.data.hasMore}
                entityLabel="shifts"
                onPageChange={goToPage}
                onPageSizeChange={changePageSize}
              />
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6 text-sm text-muted-foreground">{emptyMessage}</CardContent>
            </Card>
          )}
        </>
      ) : null}
    </section>
  );
}
