import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { availabilityApi, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime } from "@/lib/db";
import { formatWeekRangeLabel } from "@/lib/carer-availability-dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Plus, X, CalendarIcon } from "lucide-react";
import { toast } from "sonner";

type AvailabilityRange = {
  id: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
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
  onSave: (id: string, field: "startTime" | "endTime", val: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [start, setStart] = useState(toInputTime(range.startTime));
  const [end, setEnd] = useState(toInputTime(range.endTime));
  const past = isRangePast(dayDate, range.endTime);

  useEffect(() => {
    setStart(toInputTime(range.startTime));
    setEnd(toInputTime(range.endTime));
  }, [range.startTime, range.endTime]);

  async function saveStart() {
    if (start === toInputTime(range.startTime)) return;
    if (!/^\d{2}:\d{2}$/.test(start)) {
      setStart(toInputTime(range.startTime));
      return;
    }
    await onSave(range.id, "startTime", start);
  }

  async function saveEnd() {
    if (end === toInputTime(range.endTime)) return;
    if (!/^\d{2}:\d{2}$/.test(end)) {
      setEnd(toInputTime(range.endTime));
      return;
    }
    await onSave(range.id, "endTime", end);
  }

  return (
    <div
      className={
        past
          ? "flex flex-col gap-2 rounded-md border border-border bg-muted p-2.5 text-muted-foreground shadow-sm"
          : "flex flex-col gap-2 rounded-md border border-info/25 bg-info-soft p-2.5 text-foreground shadow-sm"
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
          className={`h-9 w-full border bg-surface text-sm text-foreground ${past ? "border-border opacity-90" : "border-info/30"}`}
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
          className={`h-9 w-full border bg-surface text-sm text-foreground ${past ? "border-border opacity-90" : "border-info/30"}`}
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const qc = useQueryClient();
  const weekKey = toDateStr(weekStart);

  const { data } = useQuery({
    queryKey: ["availability", staffId, weekKey],
    queryFn: () => availabilityApi.list(weekKey, staffId),
  });

  async function addRange(day: number) {
    try {
      await availabilityApi.create({
        staffId,
        weekStartDate: weekKey,
        dayOfWeek: day,
        startTime: "09:00:00",
        endTime: "17:00:00",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Add failed");
    }
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  async function updateRange(rid: string, field: "startTime" | "endTime", val: string) {
    const v = val.length === 5 ? val + ":00" : val;
    try {
      await availabilityApi.update(rid, { [field]: v });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  async function removeRange(rid: string) {
    try {
      await availabilityApi.remove(rid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
    qc.invalidateQueries({ queryKey: ["availability", staffId, weekKey] });
  }

  function jumpToDate(date: Date | undefined) {
    if (!date) return;
    setWeekStart(mondayOf(date));
    setCalendarOpen(false);
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle>Weekly availability</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10rem] text-center text-sm font-medium">
            {formatWeekRangeLabel(weekKey)}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                Jump to date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={weekStart} onSelect={jumpToDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1 xl:overflow-x-visible">
          <div className="flex min-w-max gap-3 xl:grid xl:min-w-0 xl:w-full xl:grid-cols-7 xl:gap-2">
            {DAY_FULL.map((dayName, dow) => {
              const dayDate = addDays(weekStart, dow);
              const ranges = ((data ?? []) as AvailabilityRange[]).filter(r => r.dayOfWeek === dow);
              const pastDay = isDayPast(dayDate);

              return (
                <div
                  key={dow}
                  className={`flex w-[168px] shrink-0 flex-col rounded-lg border p-3 xl:min-w-0 xl:w-auto ${
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
