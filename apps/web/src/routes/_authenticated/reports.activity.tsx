import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { BackLink } from "@/components/ui-kit";
import { ActivityLogFilters } from "@/components/reports/ActivityLogFilters";
import { ReportExportButton } from "@/components/reports/ReportExportButton";
import { ActivityLogEmptyState, ActivityLogList } from "@/components/reports/ActivityLogList";
import {
  ActivityLogPagination,
  ActivityLogPaginationSkeleton,
  ActivityLogRowSkeleton,
} from "@/components/reports/ActivityLogPagination";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACTIVITY_LOG_DEFAULT_PAGE_SIZE,
  resolveActivityLogPageSize,
  type ActivityLogPageSize,
} from "@/lib/activity-log-labels";
import { centresApi, staffApi, usersApi } from "@/lib/db";
import { formatOpsDateToronto } from "@/lib/ops-report-formatters";
import { defaultActivityLogSearch } from "@/lib/reports-dates";
import { reportsApi } from "@/lib/reports-api";
import { reportExportPaths } from "@/lib/report-export";

const searchSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: z.string().optional(),
  actorType: z.string().optional(),
  staffId: z.string().optional(),
  centreId: z.string().optional(),
  shiftId: z.string().optional(),
  opsUserId: z.string().optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/reports/activity")({
  validateSearch: (search) => searchSchema.parse(search),
  component: ActivityLogReport,
});

function ActivityLogReport() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const defaults = defaultActivityLogSearch();

  const applied = useMemo(
    () => ({
      dateFrom: search.dateFrom ?? defaults.dateFrom,
      dateTo: search.dateTo ?? defaults.dateTo,
      category: search.category ?? "all",
      actorType: search.actorType ?? "all",
      opsUserId: search.opsUserId ?? "all",
      staffId: search.staffId ?? "all",
      centreId: search.centreId ?? "all",
      shiftId: search.shiftId ?? undefined,
      page: search.page ?? 1,
      pageSize: resolveActivityLogPageSize(search.pageSize),
    }),
    [search, defaults.dateFrom, defaults.dateTo],
  );

  const [dateFrom, setDateFrom] = useState(applied.dateFrom);
  const [dateTo, setDateTo] = useState(applied.dateTo);
  const [category, setCategory] = useState(applied.category);
  const [actorType, setActorType] = useState(applied.actorType);
  const [opsUserId, setOpsUserId] = useState(applied.opsUserId);
  const [staffId, setStaffId] = useState(applied.staffId);
  const [centreId, setCentreId] = useState(applied.centreId);

  const staffQ = useQuery({
    queryKey: ["staff-list"],
    queryFn: () => staffApi.list(),
  });
  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });
  const opsUsersQ = useQuery({
    queryKey: ["ops-users-list"],
    queryFn: () => usersApi.list(),
  });

  const reportQ = useQuery({
    queryKey: [
      "reports-activity",
      applied.dateFrom,
      applied.dateTo,
      applied.category,
      applied.actorType,
      applied.opsUserId,
      applied.staffId,
      applied.centreId,
      applied.page,
      applied.pageSize,
    ],
    queryFn: () =>
      reportsApi.activityLog({
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        category: applied.category === "all" ? undefined : applied.category,
        actorType: applied.actorType === "all" ? undefined : applied.actorType,
        opsUserId:
          applied.actorType === "ops_user" && applied.opsUserId !== "all"
            ? applied.opsUserId
            : undefined,
        staffId: applied.staffId === "all" ? undefined : applied.staffId,
        centreId: applied.centreId === "all" ? undefined : applied.centreId,
        page: applied.page,
        pageSize: applied.pageSize,
      }),
  });

  function buildFilterSearch(page: number, pageSize: ActivityLogPageSize) {
    return {
      dateFrom: dateFrom === defaults.dateFrom ? undefined : dateFrom,
      dateTo: dateTo === defaults.dateTo ? undefined : dateTo,
      category: category === "all" ? undefined : category,
      actorType: actorType === "all" ? undefined : actorType,
      opsUserId:
        actorType === "ops_user" && opsUserId !== "all" ? opsUserId : undefined,
      staffId: staffId === "all" ? undefined : staffId,
      centreId: centreId === "all" ? undefined : centreId,
      page: page === 1 ? undefined : page,
      pageSize: pageSize === ACTIVITY_LOG_DEFAULT_PAGE_SIZE ? undefined : pageSize,
    };
  }

  function applyFilters() {
    navigate({
      search: buildFilterSearch(1, applied.pageSize),
    });
  }

  function resetFilters() {
    const next = defaultActivityLogSearch();
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setCategory("all");
    setActorType("all");
    setOpsUserId("all");
    setStaffId("all");
    setCentreId("all");
    navigate({ search: {} });
  }

  function goToPage(page: number) {
    navigate({
      search: {
        ...search,
        page: page === 1 ? undefined : page,
        pageSize: applied.pageSize === ACTIVITY_LOG_DEFAULT_PAGE_SIZE ? undefined : applied.pageSize,
      },
    });
  }

  function changePageSize(pageSize: ActivityLogPageSize) {
    navigate({
      search: {
        ...search,
        page: undefined,
        pageSize: pageSize === ACTIVITY_LOG_DEFAULT_PAGE_SIZE ? undefined : pageSize,
      },
    });
  }

  // Reflect the currently selected Start/End filters directly, rather than the
  // server-echoed range, so this can never disagree with the applied filters.
  const paginationProps = reportQ.data
    ? {
        page: reportQ.data.page,
        pageSize: resolveActivityLogPageSize(reportQ.data.pageSize),
        totalCount: reportQ.data.totalCount,
        hasMore: reportQ.data.hasMore,
        onPageChange: goToPage,
        onPageSizeChange: changePageSize,
      }
    : null;

  const reportReady = !reportQ.isLoading && reportQ.data != null;

  return (
    <div className="space-y-6">
      <BackLink to="/reports" label="All reports" />

      <PageHeader
        title="Activity Log"
        subtitle="Review recorded Staff, Shift, document, communication, and administrative activity."
        actions={
          <>
            <ReportExportButton
              exportPath={reportExportPaths.activityLog}
              query={{
                dateFrom: applied.dateFrom,
                dateTo: applied.dateTo,
                category: applied.category === "all" ? undefined : applied.category,
                actorType: applied.actorType === "all" ? undefined : applied.actorType,
                opsUserId:
                  applied.actorType === "ops_user" && applied.opsUserId !== "all"
                    ? applied.opsUserId
                    : undefined,
                staffId: applied.staffId === "all" ? undefined : applied.staffId,
                centreId: applied.centreId === "all" ? undefined : applied.centreId,
                shiftId: applied.shiftId,
              }}
              ready={reportReady}
              totalCount={reportQ.data?.totalCount}
            />
          </>
        }
      />

      <ActivityLogFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        category={category}
        actorType={actorType}
        opsUserId={opsUserId}
        staffId={staffId}
        centreId={centreId}
        staff={staffQ.data ?? []}
        centres={centresQ.data ?? []}
        opsUsers={opsUsersQ.data ?? []}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onCategoryChange={setCategory}
        onActorTypeChange={(value) => {
          setActorType(value);
          if (value !== "ops_user") setOpsUserId("all");
        }}
        onOpsUserChange={setOpsUserId}
        onStaffChange={setStaffId}
        onCentreChange={setCentreId}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {reportQ.isLoading ? (
        <div className="space-y-4">
          <ActivityLogPaginationSkeleton pageSize={applied.pageSize} />
          <ActivityLogRowSkeleton count={applied.pageSize} />
          <ActivityLogPaginationSkeleton pageSize={applied.pageSize} />
        </div>
      ) : null}

      {reportQ.isError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            Unable to load activity log. Please try again.
          </CardContent>
        </Card>
      ) : null}

      {reportQ.data ? (
        <div className="space-y-4">
          {paginationProps ? <ActivityLogPagination {...paginationProps} /> : null}

          {reportQ.data.items.length === 0 ? (
            <ActivityLogEmptyState />
          ) : (
            <ActivityLogList items={reportQ.data.items} />
          )}

          {paginationProps ? <ActivityLogPagination {...paginationProps} /> : null}
        </div>
      ) : null}
    </div>
  );
}
