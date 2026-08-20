import { ReportPagination } from "@/components/reports/ReportPagination";
import {
  ACTIVITY_LOG_PAGE_SIZE_OPTIONS,
  activityLogResultRange,
  type ActivityLogPageSize,
} from "@/lib/activity-log-labels";

type ActivityLogPaginationProps = {
  page: number;
  pageSize: ActivityLogPageSize;
  totalCount: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: ActivityLogPageSize) => void;
  className?: string;
};

export function ActivityLogPagination({
  page,
  pageSize,
  totalCount,
  hasMore,
  onPageChange,
  onPageSizeChange,
  className = "",
}: ActivityLogPaginationProps) {
  return (
    <ReportPagination
      page={page}
      pageSize={pageSize}
      totalCount={totalCount}
      hasMore={hasMore}
      entityLabel="activities"
      emptyLabel="0 activities"
      ariaLabel="Activity log pagination"
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      className={className}
    />
  );
}

export function ActivityLogPaginationSkeleton({ pageSize }: { pageSize: number }) {
  void pageSize;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="flex gap-3">
        <div className="h-9 w-20 animate-pulse rounded bg-muted" />
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function ActivityLogRowSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-3">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          <div className="hidden h-4 w-20 animate-pulse rounded bg-muted md:block" />
          <div className="hidden h-4 w-24 animate-pulse rounded bg-muted lg:block" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export { activityLogResultRange, ACTIVITY_LOG_PAGE_SIZE_OPTIONS };
