import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

type AvailabilityRange = {
  id: string;
  start_time: string;
  end_time: string;
  day_of_week: number;
};

function toInputTime(t: string): string {
  return t.slice(0, 5);
}

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

function TimeRangeRow({
  range,
  dayDate,
  onSave,
  onRemove,
}: {
  range: AvailabilityRange;
  dayDate: Date;
  onSave: (id: string, field: "start_time" | "end_time", val: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [start, setStart] = useState(toInputTime(range.start_time));
  const [end, setEnd] = useState(toInputTime(range.end_time));
  const past = isRangePast(dayDate, range.end_time);

  useEffect(() => {
    setStart(toInputTime(range.start_time));
    setEnd(toInputTime(range.end_time));
  }, [range.start_time, range.end_time]);

  async function saveStart() {
    if (start === toInputTime(range.start_time)) return;
    if (!/^\d{2}:\d{2}$/.test(start)) {
      setStart(toInputTime(range.start_time));
      return;
    }
    await onSave(range.id, "start_time", start);
  }

  async function saveEnd() {
    if (end === toInputTime(range.end_time)) return;
    if (!/^\d{2}:\d{2}$/.test(end)) {
      setEnd(toInputTime(range.end_time));
      return;
    }
    await onSave(range.id, "end_time", end);
  }

  return (
    <div
      className={
        past
          ? "flex flex-col gap-2 rounded-md border border-[#cfcfcf] bg-[#ececec] p-2.5 text-muted-foreground shadow-sm"
          : "flex flex-col gap-2 rounded-md border border-[#e8d5a8] bg-[#fff4db] p-2.5 shadow-sm"
      }
    >
      <div className="space-y-1">
        <Label className={`text-[11px] font-medium uppercase tracking-wide ${past ? "text-muted-foreground/80" : "text-foreground/60"}`}>
          Start
        </Label>
        <Input
          type="time"
          value={start}
          onChange={e => setStart(e.target.value)}
          onBlur={saveStart}
          className={`h-9 w-full border bg-white text-sm text-foreground ${past ? "border-[#d4d4d4] opacity-90" : "border-[#e0cfa0]"}`}
        />
      </div>
      <div className="space-y-1">
        <Label className={`text-[11px] font-medium uppercase tracking-wide ${past ? "text-muted-foreground/80" : "text-foreground/60"}`}>
          End
        </Label>
        <Input
          type="time"
          value={end}
          onChange={e => setEnd(e.target.value)}
          onBlur={saveEnd}
          className={`h-9 w-full border bg-white text-sm text-foreground ${past ? "border-[#d4d4d4] opacity-90" : "border-[#e0cfa0]"}`}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => onRemove(range.id)}
        className={`h-8 w-full justify-center text-xs hover:text-destructive ${past ? "text-muted-foreground/80" : "text-foreground/55"}`}
      >
        <X className="mr-1 h-3.5 w-3.5" />
        Remove
      </Button>
    </div>
  );
}

export function AvailabilityEditor({ staffId }: { staffId: string }) {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const qc = useQueryClient();
  const weekKey = toDateStr(weekStart);

  const { data } = useQuery({
    queryKey: ["availability", staffId, weekKey],
    queryFn: async () =>
      (await db.from("availability").select("*").eq("staff_id", staffId).eq("week_start_date", weekKey).order("day_of_week")).data ?? [],
  });

  async function addRange(day: number) {
    const { error } = await db.from("availability").insert({
      staff_id: staffId,
      week_start_date: weekKey,
      day_of_week: day,
      start_time: "09:00:00",
      end_time: "17:00:00",
    });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  async function updateRange(rid: string, field: "start_time" | "end_time", val: string) {
    const v = val.length === 5 ? val + ":00" : val;
    const { error } = await db.from("availability").update({ [field]: v }).eq("id", rid);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  async function removeRange(rid: string) {
    const { error } = await db.from("availability").delete().eq("id", rid);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Weekly availability</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center text-sm font-medium">
            {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
          </div>
          <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(mondayOf(new Date()))}>
            This week
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-3">
            {DAY_FULL.map((dayName, dow) => {
              const dayDate = addDays(weekStart, dow);
              const ranges = ((data ?? []) as AvailabilityRange[]).filter(r => r.day_of_week === dow);
              const pastDay = isDayPast(dayDate);

              return (
                <div
                  key={dow}
                  className={`flex w-[168px] shrink-0 flex-col rounded-lg border p-3 ${
                    pastDay ? "border-border/50 bg-muted/30" : "border-border bg-card"
                  }`}
                >
                  <div className={`mb-3 shrink-0 ${pastDay ? "text-muted-foreground" : ""}`}>
                    <div className="text-sm font-semibold leading-tight">{dayName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {dayDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>

                  <div className="flex min-h-[4rem] flex-1 flex-col gap-3">
                    {ranges.length === 0 && (
                      <p className="text-xs italic text-muted-foreground">No availability</p>
                    )}
                    {ranges.map(r => (
                      <TimeRangeRow
                        key={r.id}
                        range={r}
                        dayDate={dayDate}
                        onSave={updateRange}
                        onRemove={removeRange}
                      />
                    ))}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addRange(dow)}
                    className="mt-3 h-9 w-full shrink-0 text-xs"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add time
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function fmtRange(start: string, end: string) {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}
