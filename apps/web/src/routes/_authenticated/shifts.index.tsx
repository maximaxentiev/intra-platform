import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { centresApi, staffApi, shiftsApi, displayStaff, fmtTime, type ShiftStatus } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import {
  EmptyState,
  FilterChipBar,
  FilterPanel,
  ListLoading,
  dataTable,
  DataTableEmptyRow,
  DataTableLoadingRows,
} from "@/components/ui-kit";
import {
  EMPTY_SHIFT_FILTERS,
  buildShiftFilterChips,
  clearShiftFilterChip,
  hasActiveShiftFilters,
  shiftAssigneeLabel,
  shiftFiltersToSearch,
  shiftResultCountLabel,
  type ShiftFilterState,
} from "@/lib/shifts-list-ui";
import { AlertCircle, CalendarClock, ChevronRight, Info, Plus, SlidersHorizontal } from "lucide-react";
import { z } from "zod";

const searchSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  centre: z.string().optional(),
  status: z.enum(["pending", "filled", "cancelled", "completed"]).optional(),
  staff: z.string().optional(),
  staffpoint: z.enum(["yes", "no"]).optional(),
});

export const Route = createFileRoute("/_authenticated/shifts/")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ShiftsIndex,
});

const STAFFPOINT_HELP =
  "Whether this shift has also been posted to Staffpoint, the external staffing marketplace.";

function ShiftsIndex() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  // Draft filter state — applied explicitly, never live-filtered.
  const [draft, setDraft] = useState<ShiftFilterState>({
    from: search.from ?? "",
    to: search.to ?? "",
    centreId: search.centre ?? "all",
    status: (search.status ?? "all") as ShiftStatus | "all",
    staffId: search.staff ?? "all",
    staffpoint: (search.staffpoint ?? "all") as "all" | "yes" | "no",
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const applied: ShiftFilterState = {
    from: search.from ?? "",
    to: search.to ?? "",
    centreId: search.centre ?? "all",
    status: (search.status ?? "all") as ShiftStatus | "all",
    staffId: search.staff ?? "all",
    staffpoint: (search.staffpoint ?? "all") as "all" | "yes" | "no",
  };

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

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [
      "shifts-list",
      applied.from,
      applied.to,
      applied.centreId,
      applied.status,
      applied.staffId,
      applied.staffpoint,
    ],
    queryFn: async () => {
      const rows = await shiftsApi.list({
        from: applied.from || undefined,
        to: applied.to || undefined,
        centreId: applied.centreId === "all" ? undefined : applied.centreId,
        status: applied.status === "all" ? undefined : applied.status,
        staffId: applied.staffId === "all" ? undefined : applied.staffId,
      });
      if (applied.staffpoint === "yes") return rows.filter((r) => r.addedToStaffpoint);
      if (applied.staffpoint === "no") return rows.filter((r) => !r.addedToStaffpoint);
      return rows;
    },
  });

  const rows = data ?? [];
  const hasAppliedFilters = hasActiveShiftFilters(applied);
  const hasDraftFilters = hasActiveShiftFilters(draft);

  const chips = buildShiftFilterChips(applied, {
    centreName: (id) => (centresQ.data ?? []).find((c) => c.id === id)?.name,
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
      navigate({ search: shiftFiltersToSearch(next) });
    },
  }));

  function applyFilters(state: ShiftFilterState = draft) {
    navigate({ search: shiftFiltersToSearch(state) });
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    setDraft(EMPTY_SHIFT_FILTERS);
    navigate({ search: {} });
    setMobileFiltersOpen(false);
  }

  const resultContext = isLoading
    ? "Loading…"
    : isError
      ? "Results unavailable"
      : shiftResultCountLabel(rows.length);

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
        <Label className="text-xs font-medium text-muted-foreground">Centre</Label>
        <Select value={draft.centreId} onValueChange={(v) => set("centreId", v)}>
          <SelectTrigger className="h-9" aria-label="Filter by centre"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All centres</SelectItem>
            {(centresQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        subtitle="All shifts across every centre."
        actions={
          <Button asChild>
            <Link to="/shifts/new"><Plus className="h-4 w-4 mr-1.5" /> Create shift</Link>
          </Button>
        }
      />

      {/* Desktop filters */}
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

      {/* Mobile filters */}
      <div className="space-y-2 md:hidden">
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
              <div className="grid gap-3 px-4 pb-2 sm:grid-cols-2">
                {primaryFilters}
                {secondaryFilters}
              </div>
              <SheetFooter className="flex-row gap-2">
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

      {isError ? (
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
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile: structured shift cards */}
          <div className="md:hidden">
            {isLoading ? (
              <ListLoading rows={4} label="Loading shifts" />
            ) : rows.length === 0 ? (
              <ShiftsEmpty filtered={hasAppliedFilters} onClear={clearFilters} />
            ) : (
              <ul className="space-y-2">
                {rows.map((s) => {
                  const assignedName = assignedNameOf(s);
                  const assignee = shiftAssigneeLabel(assignedName, s.status as ShiftStatus);
                  const quiet = s.status === "completed" || s.status === "cancelled";
                  return (
                    <li key={s.id}>
                      <Link
                        to="/shifts/$id"
                        params={{ id: s.id }}
                        aria-label={`Open shift at ${s.centreName} on ${s.shiftDate}`}
                        className={`flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 shadow-xs transition-colors hover:bg-muted/50 active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${quiet ? "opacity-75" : ""}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium tabular-nums">{s.shiftDate}</span>
                            <StatusBadge status={s.status}>{s.status}</StatusBadge>
                          </div>
                          <div className="truncate text-sm text-foreground">{s.centreName}</div>
                          <div className="text-[13px] tabular-nums text-muted-foreground">
                            {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                            {s.roleNeeded ? ` · ${s.roleNeeded}` : ""}
                            {s.addedToStaffpoint ? " · Staffpoint" : ""}
                          </div>
                          <div
                            className={
                              assignee.needsStaff
                                ? "text-[13px] font-medium text-foreground"
                                : "text-[13px] text-muted-foreground"
                            }
                          >
                            {assignee.text}
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Desktop: table */}
          <div className={`hidden md:block ${dataTable.shell}`}>
            <div className={dataTable.scroll}>
              <Table>
                <TableHeader className={dataTable.header}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={dataTable.headerCell}>Date</TableHead>
                    <TableHead className={dataTable.headerCell}>Centre</TableHead>
                    <TableHead className={dataTable.headerCell}>Time</TableHead>
                    <TableHead className={dataTable.headerCell}>Role</TableHead>
                    <TableHead className={dataTable.headerCell}>Assigned to</TableHead>
                    <TableHead className={dataTable.headerCell}>
                      <span className="inline-flex items-center gap-1">
                        Staffpoint
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`About Staffpoint. ${STAFFPOINT_HELP}`}
                              className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Info className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64">{STAFFPOINT_HELP}</TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead className={dataTable.headerCell}>Status</TableHead>
                    <TableHead className={dataTable.headerCell}><span className="sr-only">Open</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && <DataTableLoadingRows rows={6} columns={8} />}
                  {!isLoading && rows.length === 0 && (
                    <DataTableEmptyRow columns={8}>
                      <ShiftsEmpty filtered={hasAppliedFilters} onClear={clearFilters} />
                    </DataTableEmptyRow>
                  )}
                  {!isLoading && rows.map((s) => {
                    const assignedName = assignedNameOf(s);
                    const assignee = shiftAssigneeLabel(assignedName, s.status as ShiftStatus);
                    const quiet = s.status === "completed" || s.status === "cancelled";
                    return (
                      <TableRow
                        key={s.id}
                        className={`${dataTable.row} ${dataTable.rowInteractive} ${quiet ? "opacity-75" : ""}`}
                      >
                        <TableCell className={`${dataTable.cell} font-medium tabular-nums`}>
                          <Link
                            to="/shifts/$id"
                            params={{ id: s.id }}
                            aria-label={`Open shift at ${s.centreName} on ${s.shiftDate}`}
                            className="after:absolute after:inset-0 focus-visible:outline-none"
                          >
                            {s.shiftDate}
                          </Link>
                        </TableCell>
                        <TableCell className={`${dataTable.cell} max-w-[220px] truncate`}>{s.centreName}</TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellMuted} tabular-nums`}>
                          {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                        </TableCell>
                        <TableCell className={dataTable.cell}>
                          {s.roleNeeded || <span className={dataTable.cellMuted}>—</span>}
                        </TableCell>
                        <TableCell className={dataTable.cell}>
                          <span className={assignee.needsStaff ? "font-medium text-foreground" : assignedName ? "" : "text-muted-foreground"}>
                            {assignee.text}
                          </span>
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellMuted}`}>
                          {s.addedToStaffpoint ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellStatus}`}>
                          <StatusBadge status={s.status}>{s.status}</StatusBadge>
                        </TableCell>
                        <TableCell className={`${dataTable.cell} ${dataTable.cellActions}`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function assignedNameOf(s: {
  assignedStaffId?: string | null;
  assignedLegalName?: string | null;
  assignedDisplayName?: string | null;
  assignedUseDisplayName?: boolean | null;
}) {
  return s.assignedStaffId && s.assignedLegalName
    ? displayStaff({
        legalName: s.assignedLegalName,
        displayName: s.assignedDisplayName ?? "",
        useDisplayName: s.assignedUseDisplayName ?? false,
      })
    : null;
}

function ShiftsEmpty({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  if (filtered) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No shifts match these filters"
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
      action={
        <Button asChild size="sm">
          <Link to="/shifts/new">Create shift</Link>
        </Button>
      }
      className="text-left"
    />
  );
}
