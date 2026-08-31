import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_COMPARISON_PAGE_SIZE_OPTIONS,
  reportPaginationRangeLabel,
  type ReportComparisonPageSize,
} from "@/lib/report-pagination-labels";

type ReportPaginationProps = {
  page: number;
  pageSize: ReportComparisonPageSize;
  totalCount: number;
  hasMore: boolean;
  entityLabel: string;
  emptyLabel?: string;
  ariaLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  className?: string;
};

export function ReportPagination({
  page,
  pageSize,
  totalCount,
  hasMore,
  entityLabel,
  emptyLabel,
  ariaLabel = "Report pagination",
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = REPORT_COMPARISON_PAGE_SIZE_OPTIONS,
  className = "",
}: ReportPaginationProps) {
  const rangeLabel = reportPaginationRangeLabel({
    page,
    pageSize,
    totalCount,
    entityLabel,
    emptyLabel,
  });
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);
  const showControls = totalCount > 0;

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between ${className}`}
      aria-label={ariaLabel}
    >
      <p className="text-sm text-muted-foreground">{rangeLabel}</p>

      {showControls ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-9 w-[4.5rem]" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
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

export function ReportPaginationSkeleton() {
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
