import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db, displayStaff, mondayOf, toDateStr, addDays, dowFromDate } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { CalendarClock, AlertCircle, CheckCircle2, Users, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const monday = mondayOf(new Date());
  const sunday = addDays(monday, 6);
  const today = toDateStr(new Date());
  const todayDow = dowFromDate(new Date());

  const { data, isLoading } = useQuery({
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

  const todayFmt = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Today is ${todayFmt}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          to="/shifts"
          search={{ from: toDateStr(monday), to: toDateStr(sunday) }}
          icon={CalendarClock}
          label="Shifts this week"
          value={data?.week}
          loading={isLoading}
          tone="primary"
        />
        <StatCard
          to="/shifts"
          search={{ status: "pending" }}
          icon={AlertCircle}
          label="Pending shifts"
          value={data?.pending}
          loading={isLoading}
          tone="warning"
        />
        <StatCard
          to="/shifts"
          search={{ status: "filled" }}
          icon={CheckCircle2}
          label="Filled shifts"
          value={data?.filled}
          loading={isLoading}
          tone="info"
        />
      </div>

      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-muted-foreground" /> Staff available today
              </CardTitle>
              <CardDescription>
                Active staff with availability marked for {today}.
              </CardDescription>
            </div>
            <Link
              to="/availability"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Team availability <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : !data?.availableToday?.length ? (
            <EmptyState
              title="No availability recorded for today"
              description="Set individual availability from each staff profile, or head to the availability screen."
              actionLabel="Go to Availability"
              actionTo="/availability"
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.availableToday.map((s: any) => (
                <li key={s.id}>
                  <Link
                    to="/staff/$id"
                    params={{ id: s.id }}
                    className="group flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent"
                  >
                    <span className="truncate font-medium">{displayStaff(s)}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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

function StatCard({
  to, search, icon: Icon, label, value, loading, tone,
}: {
  to: string; search?: any; icon: any; label: string; value?: number; loading?: boolean;
  tone: "primary" | "warning" | "info";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    info: "bg-success-soft text-success",
  } as const;
  return (
    <Link to={to as any} search={search as any} className="group block">
      <Card className="relative overflow-hidden border-border/70 shadow-xs transition-all group-hover:border-primary/40 group-hover:shadow-sm">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-muted-foreground">{label}</div>
            {loading ? (
              <Skeleton className="h-9 w-16 mt-2" />
            ) : (
              <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {value ?? "—"}
              </div>
            )}
          </div>
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({
  title, description, actionLabel, actionTo,
}: { title: string; description: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted px-4 py-6 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      {actionTo && actionLabel && (
        <Link
          to={actionTo as any}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {actionLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
