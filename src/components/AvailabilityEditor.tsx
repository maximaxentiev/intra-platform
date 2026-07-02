import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, DAY_LABELS, DAY_FULL, mondayOf, toDateStr, addDays, fmtTime } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";

export function AvailabilityEditor({ staffId }: { staffId: string }) {
  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["availability", staffId, toDateStr(weekStart)],
    queryFn: async () =>
      (await db.from("availability").select("*").eq("staff_id", staffId).eq("week_start_date", toDateStr(weekStart)).order("day_of_week")).data ?? [],
  });

  async function addRange(day: number) {
    const { error } = await db.from("availability").insert({
      staff_id: staffId,
      week_start_date: toDateStr(weekStart),
      day_of_week: day,
      start_time: "09:00:00",
      end_time: "17:00:00",
    });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, toDateStr(weekStart)] });
  }
  async function updateRange(rid: string, field: string, val: string) {
    const v = val.length === 5 ? val + ":00" : val;
    const { error } = await db.from("availability").update({ [field]: v }).eq("id", rid);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, toDateStr(weekStart)] });
  }
  async function removeRange(rid: string) {
    const { error } = await db.from("availability").delete().eq("id", rid);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["availability", staffId, toDateStr(weekStart)] });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Weekly availability</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="text-sm font-medium">
              Week of {weekStart.toLocaleDateString()} – {addDays(weekStart, 6).toLocaleDateString()}
            </div>
            <Button size="sm" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => setWeekStart(mondayOf(new Date()))}>This week</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAY_LABELS.map((_, dow) => {
            const ranges = (data ?? []).filter((r: any) => r.day_of_week === dow);
            return (
              <div key={dow} className="border rounded-md p-3">
                <div className="text-xs font-semibold text-muted-foreground">{DAY_FULL[dow]}</div>
                <div className="mt-2 space-y-2">
                  {ranges.length === 0 && <div className="text-xs text-muted-foreground italic">Unavailable</div>}
                  {ranges.map((r: any) => (
                    <div key={r.id} className="flex items-center gap-1">
                      <Input type="time" value={r.start_time.slice(0, 5)} onChange={e => updateRange(r.id, "start_time", e.target.value)} className="h-8 text-xs px-1" />
                      <span className="text-xs">–</span>
                      <Input type="time" value={r.end_time.slice(0, 5)} onChange={e => updateRange(r.id, "end_time", e.target.value)} className="h-8 text-xs px-1" />
                      <Button size="icon" variant="ghost" onClick={() => removeRange(r.id)} className="h-8 w-8 shrink-0"><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => addRange(dow)} className="w-full h-8 text-xs">
                    <Plus className="h-3 w-3 mr-1" /> Add time
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function fmtRange(start: string, end: string) {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}
