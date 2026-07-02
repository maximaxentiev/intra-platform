import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, displayStaff, mondayOf, toDateStr, addDays, dowFromDate } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CalendarClock, AlertCircle, CheckCircle2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const monday = mondayOf(new Date());
  const sunday = addDays(monday, 6);
  const today = toDateStr(new Date());
  const todayDow = dowFromDate(new Date());

  const { data } = useQuery({
    queryKey: ["dashboard", toDateStr(monday)],
    queryFn: async () => {
      const [weekShifts, pending, filled, availToday, staffList] = await Promise.all([
        db.from("shifts").select("id", { count: "exact", head: true }).gte("shift_date", toDateStr(monday)).lte("shift_date", toDateStr(sunday)),
        db.from("shifts").select("id", { count: "exact", head: true }).eq("status", "pending"),
        db.from("shifts").select("id", { count: "exact", head: true }).eq("status", "filled"),
        db.from("availability").select("staff_id, start_time, end_time").eq("week_start_date", toDateStr(monday)).eq("day_of_week", todayDow),
        db.from("staff").select("id, legal_name, display_name, use_display_name, status").eq("status", "active"),
      ]);
      const byId = new Map<string, any>((staffList.data ?? []).map((s: any) => [s.id, s]));
      const availStaffIds = new Set<string>((availToday.data ?? []).map((a: any) => a.staff_id));
      const availableToday = Array.from(availStaffIds).map(id => byId.get(id)).filter(Boolean);
      return {
        week: weekShifts.count ?? 0,
        pending: pending.count ?? 0,
        filled: filled.count ?? 0,
        availableToday,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today is {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/shifts" search={{ from: toDateStr(monday), to: toDateStr(sunday) } as any}>
          <StatCard icon={CalendarClock} label="Shifts this week" value={data?.week ?? "—"} />
        </Link>
        <Link to="/shifts" search={{ status: "pending" } as any}>
          <StatCard icon={AlertCircle} label="Pending shifts" value={data?.pending ?? "—"} accent="warning" />
        </Link>
        <Link to="/shifts" search={{ status: "filled" } as any}>
          <StatCard icon={CheckCircle2} label="Filled shifts" value={data?.filled ?? "—"} accent="success" />
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff available today</CardTitle>
          <CardDescription>Active staff with availability marked for {today}.</CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.availableToday?.length ? (
            <div className="text-sm text-muted-foreground">No staff have availability set for today. <Link to="/availability" className="underline">Go to Availability</Link>.</div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.availableToday.map((s: any) => (
                <li key={s.id}>
                  <Link to="/staff/$id" params={{ id: s.id }} className="block rounded-md border px-3 py-2 text-sm hover:bg-muted">
                    {displayStaff(s)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  const color = accent === "warning" ? "text-amber-600" : accent === "success" ? "text-emerald-600" : "text-primary";
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-1">{value}</div>
        </div>
        <Icon className={`h-8 w-8 ${color}`} />
      </CardContent>
    </Card>
  );
}
