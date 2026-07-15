import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, displayStaff, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime, dowFromDate, fromDateStr } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

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

export const Route = createFileRoute("/_authenticated/availability")({
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [timeStartFilter, setTimeStartFilter] = useState<string>("");
  const [timeEndFilter, setTimeEndFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

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
    queryFn: async () => (await db.from("staff").select("id, legal_name, display_name, use_display_name, role").eq("status", "active").order("legal_name")).data ?? [],
  });
  const availQ = useQuery({
    queryKey: ["availability-week", weekKey],
    queryFn: async () => (await db.from("availability").select("*").eq("week_start_date", weekKey)).data ?? [],
  });

  const active = dateFilter ? String(dowFromDate(fromDateStr(dateFilter))) : dayFilter;
  const filterStart = /^\d{2}:\d{2}$/.test(timeStartFilter) ? timeStartFilter + ":00" : null;
  const filterEnd = /^\d{2}:\d{2}$/.test(timeEndFilter) ? timeEndFilter + ":00" : null;

  function matchesTimeFilter(entry: { start_time: string; end_time: string }) {
    if (!filterStart) return true;
    if (!filterEnd) return entry.start_time <= filterStart && entry.end_time > filterStart;
    return entry.start_time < filterEnd && entry.end_time > filterStart;
  }

  const rows = (staffQ.data ?? []).map((s: any) => {
    let entries = (availQ.data ?? []).filter((a: any) => a.staff_id === s.id);
    if (active !== "all") entries = entries.filter((a: any) => String(a.day_of_week) === active);
    if (filterStart) entries = entries.filter(matchesTimeFilter);
    return { staff: s, entries };
  }).filter((r: any) => (active !== "all" || filterStart) ? r.entries.length > 0 : true);

  function clearFilters() {
    setDayFilter("all");
    setTimeStartFilter("");
    setTimeEndFilter("");
    setDateFilter("");
    setWeekStart(mondayOf(new Date()));
  }

  function handleDateFilterChange(value: string) {
    setDateFilter(value);
    if (!value) return;
    const picked = fromDateStr(value);
    setWeekStart(mondayOf(picked));
    setDayFilter(String(dowFromDate(picked)));
  }

  function handleDayFilterChange(value: string) {
    setDayFilter(value);
    setDateFilter("");
  }

  function shiftWeek(delta: number) {
    setWeekStart(prev => addDays(prev, delta));
    setDateFilter("");
    if (dayFilter !== "all") setDayFilter("all");
  }

  function goToThisWeek() {
    setWeekStart(mondayOf(new Date()));
    setDateFilter("");
    setDayFilter("all");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Team availability</h1>
        <p className="text-sm text-muted-foreground">See who is available across the whole team. Set individual availability from each staff profile.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Week of {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}</CardTitle>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => shiftWeek(-7)} aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={goToThisWeek}>This week</Button>
              <Button size="sm" variant="outline" onClick={() => shiftWeek(7)} aria-label="Next week">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5 mb-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Filter by day</Label>
              <Select value={dayFilter} onValueChange={handleDayFilterChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {DAY_FULL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Or filter by specific date</Label>
              <Input type="date" value={dateFilter} onChange={e => handleDateFilterChange(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Available during time</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">From</Label>
                  <Input type="time" value={timeStartFilter} onChange={e => setTimeStartFilter(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">To (optional)</Label>
                  <Input type="time" value={timeEndFilter} onChange={e => setTimeEndFilter(e.target.value)} />
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </Button>
          </div>

          <div className="border rounded-md divide-y">
            {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No staff match these filters.</div>}
            {rows.map(({ staff, entries }: any) => (
              <div key={staff.id} className="p-3 flex items-start gap-4">
                <Link to="/staff/$id" params={{ id: staff.id }} className="w-48 shrink-0 font-medium hover:underline">{displayStaff(staff)}</Link>
                <div className="flex-1 flex flex-wrap gap-2">
                  {entries.length === 0 && <span className="text-xs text-muted-foreground italic">No availability set for this week</span>}
                  {entries.sort((a: any, b: any) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map((a: any) => {
                    const dayDate = addDays(weekStart, a.day_of_week);
                    const past = isRangePast(dayDate, a.end_time);
                    return (
                      <span
                        key={a.id}
                        className={`text-xs px-2 py-1 rounded border ${
                          past
                            ? "border-[#cfcfcf] bg-[#ececec] text-muted-foreground"
                            : "border-[#e8d5a8] bg-[#fff4db] text-foreground"
                        }`}
                      >
                        <b>{DAY_FULL[a.day_of_week].slice(0, 3)}</b> {fmtTime(a.start_time)} – {fmtTime(a.end_time)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
