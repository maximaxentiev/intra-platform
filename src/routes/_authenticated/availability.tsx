import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, displayStaff, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime, dowFromDate } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/availability")({
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("");

  const staffQ = useQuery({
    queryKey: ["staff-active"],
    queryFn: async () => (await db.from("staff").select("id, legal_name, display_name, use_display_name, role").eq("status", "active").order("legal_name")).data ?? [],
  });
  const availQ = useQuery({
    queryKey: ["availability-week", toDateStr(weekStart)],
    queryFn: async () => (await db.from("availability").select("*").eq("week_start_date", toDateStr(weekStart))).data ?? [],
  });

  const active = dateFilter ? String(dowFromDate(new Date(dateFilter))) : dayFilter;
  const timeMatch = timeFilter && /^\d{2}:\d{2}$/.test(timeFilter) ? timeFilter + ":00" : null;

  const rows = (staffQ.data ?? []).map((s: any) => {
    let entries = (availQ.data ?? []).filter((a: any) => a.staff_id === s.id);
    if (active !== "all") entries = entries.filter((a: any) => String(a.day_of_week) === active);
    if (timeMatch) entries = entries.filter((a: any) => a.start_time <= timeMatch && a.end_time > timeMatch);
    return { staff: s, entries };
  }).filter((r: any) => (active !== "all" || timeMatch) ? r.entries.length > 0 : true);

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
              <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>
              <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 mb-4">
            <div className="space-y-1">
              <Label className="text-xs">Filter by day</Label>
              <Select value={dayFilter} onValueChange={v => { setDayFilter(v); setDateFilter(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {DAY_FULL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Or filter by specific date</Label>
              <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Available at specific time (HH:MM)</Label>
              <Input type="time" value={timeFilter} onChange={e => setTimeFilter(e.target.value)} />
            </div>
          </div>

          <div className="border rounded-md divide-y">
            {rows.length === 0 && <div className="p-6 text-sm text-muted-foreground text-center">No staff match these filters.</div>}
            {rows.map(({ staff, entries }: any) => (
              <div key={staff.id} className="p-3 flex items-start gap-4">
                <Link to="/staff/$id" params={{ id: staff.id }} className="w-48 shrink-0 font-medium hover:underline">{displayStaff(staff)}</Link>
                <div className="flex-1 flex flex-wrap gap-2">
                  {entries.length === 0 && <span className="text-xs text-muted-foreground italic">No availability set for this week</span>}
                  {entries.sort((a: any, b: any) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)).map((a: any) => (
                    <span key={a.id} className="text-xs bg-muted px-2 py-1 rounded">
                      <b>{DAY_FULL[a.day_of_week].slice(0, 3)}</b> {fmtTime(a.start_time)} – {fmtTime(a.end_time)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
