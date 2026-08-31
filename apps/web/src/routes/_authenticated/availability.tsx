import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { staffApi, availabilityApi, displayStaff, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime, dowFromDate, fromDateStr } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const UPCOMING_PREVIEW_LIMIT = 6;

type AvailabilityEntry = {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

function isDayPast(dayDate: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function isRangePast(dayDate: Date, endTime: string): boolean {
  if (isDayPast(dayDate)) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dayDate);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() > today.getTime()) return false;

  const [h, m] = endTime.split(":").map(Number);
  const end = new Date(dayDate);
  end.setHours(h, m, 0, 0);
  return end <= new Date();
}

function sortEntries(entries: AvailabilityEntry[], weekStart: Date) {
  return [...entries].sort((a, b) => {
    const dayA = addDays(weekStart, a.dayOfWeek).getTime();
    const dayB = addDays(weekStart, b.dayOfWeek).getTime();
    if (dayA !== dayB) return dayA - dayB;
    return a.startTime.localeCompare(b.startTime);
  });
}

function AvailabilityChip({
  entry,
  weekStart,
}: {
  entry: AvailabilityEntry;
  weekStart: Date;
}) {
  const dayDate = addDays(weekStart, entry.dayOfWeek);
  const past = isRangePast(dayDate, entry.endTime);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border tabular-nums ${
        past
          ? "bg-muted text-muted-foreground border-border"
          : "bg-info-soft text-foreground border-info/25"
      }`}
    >
      <span className="font-semibold uppercase tracking-wide">{DAY_FULL[entry.dayOfWeek].slice(0, 3)}</span>
      <span className="opacity-80">·</span>
      {fmtTime(entry.startTime)} – {fmtTime(entry.endTime)}
    </span>
  );
}

function StaffAvailabilitySection({
  staffName,
  staffId,
  entries,
  weekStart,
}: {
  staffName: string;
  staffId: string;
  entries: AvailabilityEntry[];
  weekStart: Date;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortEntries(entries, weekStart);
  const upcoming = sorted.filter((entry) => !isRangePast(addDays(weekStart, entry.dayOfWeek), entry.endTime));
  const initialVisible = upcoming.slice(0, UPCOMING_PREVIEW_LIMIT);
  const hasMoreThanPreview = sorted.length > initialVisible.length;
  const visible = expanded ? sorted : initialVisible;

  return (
    <li className="p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
        <Link
          to="/staff/$id"
          params={{ id: staffId }}
          className="w-full shrink-0 text-sm font-medium text-foreground hover:text-primary lg:w-40 xl:w-48"
        >
          {staffName}
        </Link>

        <div className="min-w-0 flex-1">
          {entries.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No availability set</span>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((entry) => (
                <AvailabilityChip key={entry.id} entry={entry} weekStart={weekStart} />
              ))}
            </div>
          )}
        </div>

        {hasMoreThanPreview ? (
          <div className="flex justify-end lg:w-28 lg:shrink-0 lg:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show less" : "View more"}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export const Route = createFileRoute("/_authenticated/availability")({
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [timeStartFilter, setTimeStartFilter] = useState<string>("");
  const [timeEndFilter, setTimeEndFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const weekKey = toDateStr(weekStart);
  const thisWeekKey = toDateStr(mondayOf(new Date()));
  const hasFilters =
    dayFilter !== "all" ||
    timeStartFilter !== "" ||
    timeEndFilter !== "" ||
    dateFilter !== "" ||
    weekKey !== thisWeekKey;

  const staffQ = useQuery({
    queryKey: ["staff-active"],
    queryFn: () => staffApi.list(),
  });
  const availQ = useQuery({
    queryKey: ["availability-week", weekKey],
    queryFn: () => availabilityApi.list(weekKey),
  });

  const active = dateFilter ? String(dowFromDate(fromDateStr(dateFilter))) : dayFilter;
  const filterStart = /^\d{2}:\d{2}$/.test(timeStartFilter) ? timeStartFilter + ":00" : null;
  const filterEnd = /^\d{2}:\d{2}$/.test(timeEndFilter) ? timeEndFilter + ":00" : null;

  function matchesTimeFilter(entry: { startTime: string; endTime: string }) {
    if (!filterStart) return true;
    if (!filterEnd) return entry.startTime <= filterStart && entry.endTime > filterStart;
    return entry.startTime < filterEnd && entry.endTime > filterStart;
  }

  const rows = (staffQ.data ?? []).map((s) => {
    let entries = (availQ.data ?? []).filter((a) => a.staffId === s.id);
    if (active !== "all") entries = entries.filter((a) => String(a.dayOfWeek) === active);
    if (filterStart) entries = entries.filter(matchesTimeFilter);
    return { staff: s, entries };
  }).filter((r) => (active !== "all" || filterStart) ? r.entries.length > 0 : true);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setDayFilter("all");
    setTimeStartFilter("");
    setTimeEndFilter("");
    setDateFilter("");
    setWeekStart(mondayOf(new Date()));
    setPage(1);
  }

  function handleDateFilterChange(value: string) {
    setDateFilter(value);
    setPage(1);
    if (!value) return;
    const picked = fromDateStr(value);
    setWeekStart(mondayOf(picked));
    setDayFilter(String(dowFromDate(picked)));
  }

  function handleDayFilterChange(value: string) {
    setDayFilter(value);
    setDateFilter("");
    setPage(1);
  }

  function shiftWeek(delta: number) {
    setWeekStart(prev => addDays(prev, delta));
    setDateFilter("");
    if (dayFilter !== "all") setDayFilter("all");
    setPage(1);
  }

  function goToThisWeek() {
    setWeekStart(mondayOf(new Date()));
    setDateFilter("");
    setDayFilter("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team availability" />

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-4 border-b border-border/70">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base font-semibold">
              Week of {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
            </CardTitle>
            <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => shiftWeek(-7)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8 px-3 text-xs font-medium" onClick={goToThisWeek}>This week</Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => shiftWeek(7)} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-5 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Filter by day</Label>
              <Select value={dayFilter} onValueChange={handleDayFilterChange}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {DAY_FULL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Or specific date</Label>
              <Input type="date" value={dateFilter} onChange={e => handleDateFilterChange(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium text-muted-foreground">Available during time</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input type="time" value={timeStartFilter} onChange={e => { setTimeStartFilter(e.target.value); setPage(1); }} className="h-10" aria-label="From time" placeholder="From" />
                <Input type="time" value={timeEndFilter} onChange={e => { setTimeEndFilter(e.target.value); setPage(1); }} className="h-10" aria-label="To time" placeholder="To" />
              </div>
            </div>
            <Button variant="outline" onClick={clearFilters} disabled={!hasFilters} className="h-10">
              <X className="h-4 w-4 mr-1.5" /> Clear filters
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-card">
            {rows.length === 0 && (
              <div className="p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="mt-3 text-sm font-medium">No staff match these filters</div>
                <div className="mt-1 text-xs text-muted-foreground">Try clearing filters or picking a different week.</div>
              </div>
            )}
            <ul className="divide-y divide-border">
              {pagedRows.map(({ staff, entries }) => (
                <StaffAvailabilitySection
                  key={staff.id}
                  staffId={staff.id}
                  staffName={displayStaff(staff)}
                  entries={entries}
                  weekStart={weekStart}
                />
              ))}
            </ul>
          </div>

          {rows.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}
                >
                  <SelectTrigger className="h-8 w-[4.5rem]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span>
                  Showing {(currentPage - 1) * pageSize + 1}
                  –{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
                </span>
              </div>

              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage > 1) setPage(currentPage - 1); }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive className="pointer-events-none">
                      {currentPage} / {totalPages}
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setPage(currentPage + 1); }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
