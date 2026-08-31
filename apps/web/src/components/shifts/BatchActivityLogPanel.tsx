import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ActivityLogPaginationSkeleton,
  ActivityLogRowSkeleton,
} from "@/components/reports/ActivityLogPagination";
import { ShiftActivityFeed } from "@/components/shifts/ShiftActivityFeed";
import { Button } from "@/components/ui/button";
import { EmptyState, SectionCard } from "@/components/ui-kit";
import { shiftBatchesApi } from "@/lib/db";

const PAGE_SIZE = 10;

type Props = {
  batchId: string;
};

export function BatchActivityLogPanel({ batchId }: Props) {
  const [page, setPage] = useState(1);

  const activityQ = useQuery({
    queryKey: ["shift-batch-activity", batchId, page],
    queryFn: () => shiftBatchesApi.getBatchActivity(batchId, page, PAGE_SIZE),
  });

  const data = activityQ.data;
  const items = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const hasMore = data?.hasMore ?? false;

  return (
    <SectionCard id="batch-activity-log" title="Batch Activity" className="min-w-0 text-foreground">
      {activityQ.isLoading ? (
        <div className="space-y-3">
          <ActivityLogRowSkeleton count={PAGE_SIZE} />
          <ActivityLogPaginationSkeleton pageSize={PAGE_SIZE} />
        </div>
      ) : activityQ.isError ? (
        <EmptyState
          title="Batch Activity could not be loaded"
          description="Try refreshing the page."
          className="text-left"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="No Batch Activity yet"
          description="Batch-level events will appear here."
          className="text-left"
        />
      ) : (
        <div className="min-w-0 space-y-3">
          <ShiftActivityFeed items={items} />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="min-w-0 text-sm text-muted-foreground">
              {totalCount === 0
                ? "0 activities"
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || activityQ.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasMore || activityQ.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
