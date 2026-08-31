import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { centresApi, staffApi, shiftsApi, displayStaff, type ShiftStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PageHeader } from "@/components/PageHeader";
import { ReportPagination } from "@/components/reports/ReportPagination";
import {
  EmptyState,
  FilterChipBar,
  FilterPanel,
} from "@/components/ui-kit";
import { CreateShiftActions } from "@/components/shifts/CreateShiftActions";
import { ShiftsFeedList } from "@/components/shifts/ShiftsFeedList";
import {
  EMPTY_SHIFT_FILTERS,
  buildShiftFilterChips,
  clearShiftFilterChip,
  feedResultCountLabel,
  hasActiveShiftFilters,
  shiftCentreSelectionFromSearch,
  shiftCentreSelectionToApiQuery,
  shiftFiltersToSearch,
  type ShiftFilterState,
} from "@/lib/shifts-list-ui";
import {
  SHIFT_FEED_PAGE_SIZE_OPTIONS,
  resolveShiftFeedPageSize,
} from "@/lib/shifts-feed-ui";
import { ReportCentreMultiSelect } from "@/components/reports/CentreUsageFilters";
import { AlertCircle, CalendarClock, SlidersHorizontal } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  centre: z.string().optional(),
  centreIds: z.string().optional(),
  status: z.enum(["pending", "filled", "cancelled", "completed"]).optional(),
  staff: z.string().optional(),
  staffpoint: z.enum(["yes", "no"]).optional(),
  page: z.coerce.number().optional(),
  pageSize: z.coerce.number().optional(),
});

type ShiftSearch = z.infer<typeof searchSchema>;

function shiftFiltersFromSearch(search: ShiftSearch): ShiftFilterState {
  return {
    from: search.from ?? "",
    to: search.to ?? "",
    centres: shiftCentreSelectionFromSearch(search),
    status: (search.status ?? "all") as ShiftStatus | "all",
    staffId: search.staff ?? "all",
    staffpoint: (search.staffpoint ?? "all") as "all" | "yes" | "no",
  };
}

export const Route = createFileRoute("/_authenticated/shifts/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ShiftsIndex,
});

function ShiftsIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const [draft, setDraft] = useState<ShiftFilterState>(() => shiftFiltersFromSearch(search));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(() => new Set());

  const applied = shiftFiltersFromSearch(search);
  const page = search.page && search.page > 0 ? search.page : 1;
  const pageSize = resolveShiftFeedPageSize(search.pageSize);

  const set = <K extends keyof ShiftFilterState>(key: K, value: ShiftFilterState[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const centresQ = useQuery({
    queryKey: ["centres-all"],
    queryFn: () => centresApi.list(),
  });
  const staffQ = useQuery({
    queryKey: ["staff-all"],
    queryFn: () => staffApi.list(),
  });

  const feedQ = useQuery({
    queryKey: [
      "shifts-feed",
      applied.from,
      applied.to,
      applied.centres.mode,
      applied.centres.centreIds.join(","),
      applied.status,
      applied.staffId,
      applied.staffpoint,
      page,
      pageSize,
    ],
    queryFn: () =>
      shiftsApi.feed({
        from: applied.from || undefined,
        to: applied.to || undefined,
        ...shiftCentreSelectionToApiQuery(applied),
        status: applied.status === "all" ? undefined : applied.status,
        staffId: applied.staffId === "all" ? undefined : applied.staffId,
        staffpoint: applied.staffpoint === "all" ? undefined : applied.staffpoint,
        page,
        pageSize,
      }),
  });

  const feed = feedQ.data;
  const items = feed?.items ?? [];
  const hasAppliedFilters = hasActiveShiftFilters(applied);
  const hasDraftFilters = hasActiveShiftFilters(draft);

  const chips = buildShiftFilterChips(applied, {
    centres: centresQ.data ?? [],
    staffName: (id) => {
      const found = (staffQ.data ?? []).find((s) => s.id === id);
      return found ? displayStaff(found) : undefined;
    },
  }).map((chip) => ({
    id: chip.id,
    field: chip.field,
    label: chip.label,
    onRemove: () => {
      const next = clearShiftFilterChip(applied, chip.id);
      setDraft(next);
      navigate({ search: shiftFiltersToSearch(next, { page: 1, pageSize }) });
    },
  }));

  function applyFilters(state: ShiftFilterState = draft) {
    navigate({ search: shiftFiltersToSearch(state, { page: 1, pageSize }) });
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    setDraft(EMPTY_SHIFT_FILTERS);
    navigate({ search: {} });
    setMobileFiltersOpen(false);
  }

  function toggleBatch(batchId: string) {
    setExpandedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  const resultContext = feedQ.isLoading
    ? "Loading…"
    : feedQ.isError
      ? "Results unavailable"
      : feedResultCountLabel(feed?.totalItems ?? 0);

  const primaryFilters = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={draft.from}
          onChange={(e) => set("from", e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground">To</Label>
        <Input
          id="filter-to"
          type="date"
          value={draft.to}
          onChange={(e) => set("to", e.target.value)}
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Centres</Label>
        <ReportCentreMultiSelect
          centres={centresQ.data ?? []}
          selection={draft.centres}
          onSelectionChange={(centres) => set("centres", centres)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Status</Label>
        <Select value={draft.status} onValueChange={(v) => set("status", v as ShiftStatus | "all")}>
          <SelectTrigger className="h-9" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const secondaryFilters = (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Assigned to</Label>
        <Select value={draft.staffId} onValueChange={(v) => set("staffId", v)}>
          <SelectTrigger className="h-9" aria-label="Filter by assigned staff"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {(staffQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{displayStaff(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Staffpoint</Label>
        <Select value={draft.staffpoint} onValueChange={(v) => set("staffpoint", v as "all" | "yes" | "no")}>
          <SelectTrigger className="h-9" aria-label="Filter by Staffpoint"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const emptyState = (
    <ShiftsEmpty filtered={hasAppliedFilters} onClear={clearFilters} />
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Shifts" actions={<CreateShiftActions />} />

      <div className="hidden md:block">
        <FilterPanel
          advanced={secondaryFilters}
          advancedLabel="More filters"
          defaultAdvancedOpen={applied.staffId !== "all" || applied.staffpoint !== "all"}
          onApply={() => applyFilters()}
          applyLabel="Apply filters"
          onClear={hasAppliedFilters || hasDraftFilters ? clearFilters : undefined}
          clearLabel="Clear all"
          resultContext={resultContext}
          chips={chips.length > 0 ? <FilterChipBar chips={chips} /> : undefined}
        >
          {primaryFilters}
        </FilterPanel>
      </div>

      <div className="space-y-1.5 md:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-muted-foreground" aria-live="polite">{resultContext}</p>
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                Filters
                {chips.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-xs tabular-nums">{chips.length}</span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter shifts</SheetTitle>
                <SheetDescription>Filters apply when you tap Apply filters.</SheetDescription>
              </SheetHeader>
              <div className="grid gap-3 py-4 sm:grid-cols-2">
                {primaryFilters}
                {secondaryFilters}
              </div>
              <SheetFooter className="flex-row gap-2 sm:justify-end">
                <Button variant="outline" className="flex-1" onClick={clearFilters} disabled={!hasDraftFilters}>
                  Clear all
                </Button>
                <Button className="flex-1" onClick={() => applyFilters()}>Apply filters</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
        {chips.length > 0 && <FilterChipBar chips={chips} onClearAll={clearFilters} />}
      </div>

      {feedQ.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-3.5 shadow-xs"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Shifts could not be loaded</p>
            <p className="text-[13px] text-muted-foreground">
              This is a loading problem, not an empty result. Try again.
            </p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void feedQ.refetch()} disabled={feedQ.isFetching}>
            {feedQ.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <>
          <ShiftsFeedList
            items={items}
            isLoading={feedQ.isLoading}
            expandedBatchIds={expandedBatchIds}
            onToggleBatch={toggleBatch}
            emptyState={emptyState}
          />

          {!feedQ.isLoading && (feed?.totalItems ?? 0) > 0 ? (
            <ReportPagination
              page={page}
              pageSize={pageSize}
              totalCount={feed?.totalItems ?? 0}
              hasMore={page < (feed?.totalPages ?? 0)}
              entityLabel="items"
              ariaLabel="Shifts feed pagination"
              pageSizeOptions={SHIFT_FEED_PAGE_SIZE_OPTIONS}
              onPageChange={(nextPage) =>
                navigate({ search: shiftFiltersToSearch(applied, { page: nextPage, pageSize }) })
              }
              onPageSizeChange={(nextPageSize) =>
                navigate({
                  search: shiftFiltersToSearch(applied, {
                    page: 1,
                    pageSize: resolveShiftFeedPageSize(nextPageSize),
                  }),
                })
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function ShiftsEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No shifts or batch requests match these filters"
        description="Try a wider date range or a different centre."
        action={
          <Button variant="outline" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        }
        className="text-left"
      />
    );
  }
  return (
    <EmptyState
      icon={CalendarClock}
      title="No shifts yet"
      description="Create the first shift to start staffing."
      action={<CreateShiftActions size="sm" />}
      className="text-left"
    />
  );
}
