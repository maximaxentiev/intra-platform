import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const { start, end, totalPages } = activityLogResultRange({ page, pageSize, totalCount });
  const showControls = totalCount > 0;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
      aria-label="Activity log pagination"
    >
      <p className="text-sm text-muted-foreground">
        {totalCount === 0 ? "0 activities" : `Showing ${start}–${end} of ${totalCount} activities`}
      </p>

      {showControls ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value) as ActivityLogPageSize)}
            >
              <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_LOG_PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="min-w-[6.5rem] text-center text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={!hasMore}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ActivityLogPaginationSkeleton({ pageSize }: { pageSize: number }) {
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
