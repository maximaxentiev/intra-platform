import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { CarerShiftCard } from "@/components/carer/CarerShiftCard";
import { cn } from "@/lib/utils";
import type { CarerShiftPageSize } from "@/lib/carer-shifts";
import {
  useCarerShiftsHistory,
  useCarerShiftsUpcoming,
} from "@/lib/carer-shifts-queries";
import { carerShiftsRangeLabel } from "@/lib/carer-shifts-display";

type ShiftsTab = "upcoming" | "history";

const PAGE_SIZE_OPTIONS: CarerShiftPageSize[] = [10, 25];

function ShiftsTabToggle({
  value,
  onChange,
}: {
  value: ShiftsTab;
  onChange: (tab: ShiftsTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Shift views"
      className="inline-flex rounded-lg border bg-muted/30 p-1"
    >
      {(["upcoming", "history"] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          className={cn(
            "min-h-11 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors",
            value === tab
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function ShiftsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p className="text-foreground">Unable to load shifts.</p>
      <Button type="button" variant="outline" size="sm" className="h-11" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function ShiftsListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading shifts">
      {[1, 2, 3].map((key) => (
        <div key={key} className="h-32 animate-pulse rounded-md border bg-muted/40" />
      ))}
    </div>
  );
}

type ShiftsTabPanelProps = {
  tab: ShiftsTab;
  activeTab: ShiftsTab;
  page: number;
  pageSize: CarerShiftPageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: CarerShiftPageSize) => void;
};

function ShiftsTabPanel({
  tab,
  activeTab,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ShiftsTabPanelProps) {
  const isActive = tab === activeTab;
  const upcoming = useCarerShiftsUpcoming(page, pageSize, tab === "upcoming" && isActive);
  const history = useCarerShiftsHistory(page, pageSize, tab === "history" && isActive);

  const query = tab === "upcoming" ? upcoming : history;
  const { data, isLoading, isError, refetch } = query;
  const rangeLabel = carerShiftsRangeLabel(data ?? undefined);
  const emptyCopy =
    tab === "upcoming"
      ? "No upcoming shifts assigned."
      : "No previous shifts yet.";
  const emptySupport =
    tab === "upcoming"
      ? "Your assigned shifts will appear here."
      : "Your completed and past assigned shifts will appear here.";

  function handlePageSizeChange(value: string) {
    onPageSizeChange(Number(value) as CarerShiftPageSize);
    onPageChange(1);
  }

  return (
    <div
      role="tabpanel"
      id={`carer-shifts-panel-${tab}`}
      aria-labelledby={`carer-shifts-tab-${tab}`}
      hidden={!isActive}
      className="space-y-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {tab === "upcoming"
            ? "Shifts you are currently assigned to."
            : "Completed and past assigned shifts."}
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Show:</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-11 w-[5.5rem]" aria-label={`${tab} shifts page size`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? <ShiftsLoadError onRetry={() => void refetch()} /> : null}

      {isLoading ? <ShiftsListSkeleton /> : null}

      {!isLoading && !isError && (data?.items.length ?? 0) === 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{emptyCopy}</p>
          <p className="text-muted-foreground">{emptySupport}</p>
        </div>
      ) : null}

      {!isLoading && !isError && data && data.items.length > 0 ? (
        <ul className="space-y-3">
          {data.items.map((shift) => (
            <li key={shift.id}>
              <CarerShiftCard shift={shift} />
            </li>
          ))}
        </ul>
      ) : null}

      {data && data.totalPages > 1 ? (
        <div className="space-y-3">
          {rangeLabel ? <p className="text-sm text-muted-foreground">{rangeLabel}</p> : null}
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-label={`Previous ${tab} shifts page`}
                  className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) onPageChange(page - 1);
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-3 text-sm text-muted-foreground">
                  Page {page} of {data.totalPages}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-label={`Next ${tab} shifts page`}
                  className={page >= data.totalPages ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < data.totalPages) onPageChange(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : rangeLabel ? (
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
      ) : null}
    </div>
  );
}

export function CarerShiftsManager() {
  const [activeTab, setActiveTab] = useState<ShiftsTab>("upcoming");
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [upcomingPageSize, setUpcomingPageSize] = useState<CarerShiftPageSize>(10);
  const [historyPageSize, setHistoryPageSize] = useState<CarerShiftPageSize>(25);

  function handleTabChange(tab: ShiftsTab) {
    setActiveTab(tab);
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <ShiftsTabToggle value={activeTab} onChange={handleTabChange} />

      <ShiftsTabPanel
        tab="upcoming"
        activeTab={activeTab}
        page={upcomingPage}
        pageSize={upcomingPageSize}
        onPageChange={setUpcomingPage}
        onPageSizeChange={(size) => {
          setUpcomingPageSize(size);
          setUpcomingPage(1);
        }}
      />

      <ShiftsTabPanel
        tab="history"
        activeTab={activeTab}
        page={historyPage}
        pageSize={historyPageSize}
        onPageChange={setHistoryPage}
        onPageSizeChange={(size) => {
          setHistoryPageSize(size);
          setHistoryPage(1);
        }}
      />
    </div>
  );
}
