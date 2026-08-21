import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Plus,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DashboardMetric,
  DashboardSection,
  DashboardSkeleton,
} from "@/components/dashboard/DashboardPrimitives";
import { NeedsAttentionSection } from "@/components/dashboard/NeedsAttentionSection";
import { TodayShiftsSection } from "@/components/dashboard/TodayShiftsSection";
import { Next7DaysSection } from "@/components/dashboard/Next7DaysSection";
import { WorkforceReadinessSection } from "@/components/dashboard/WorkforceReadinessSection";
import { RecentActivitySection } from "@/components/dashboard/RecentActivitySection";
import { dashboardOverviewApi } from "@/lib/dashboard-api";
import {
  formatDashboardHeaderDate,
  todayShiftsSearch,
} from "@/lib/dashboard-overview-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const QUICK_ACTIONS = [
  { label: "Add Staff", to: "/staff/new" },
  { label: "Add Centre", to: "/centres/new" },
  { label: "Team Availability", to: "/availability" },
  { label: "Review Documents", to: "/reports/documents" },
  { label: "Reports", to: "/reports" },
] as const;

function Dashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => dashboardOverviewApi.overview(),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={data ? formatDashboardHeaderDate(data.today.date) : "Toronto"}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/shifts/new">
                <Plus className="h-4 w-4" aria-hidden="true" /> Create shift
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Quick actions
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {QUICK_ACTIONS.map((action) => (
                  <DropdownMenuItem key={action.to} asChild>
                    <Link to={action.to as any}>{action.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : isError || !data ? (
        <Card className="border-destructive/30 p-6 shadow-xs" role="alert">
          <h2 className="text-base font-semibold text-foreground">
            We couldn't load the Dashboard.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try again. If the problem continues, you can still use the navigation to access the
            platform.
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <NeedsAttentionSection attention={data.attention} />

          <DashboardSection
            id="today"
            title="Today"
            description="Toronto schedule at a glance."
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <DashboardMetric
                label="Shifts"
                value={data.today.total}
                icon={CalendarClock}
                tone="primary"
                to="/shifts"
                search={todayShiftsSearch(data.today.date)}
              />
              <DashboardMetric
                label="Pending"
                value={data.today.pending}
                icon={AlertCircle}
                tone="warning"
                to="/shifts"
                search={todayShiftsSearch(data.today.date, "pending")}
              />
              <DashboardMetric
                label="Filled"
                value={data.today.filled}
                icon={UserCheck}
                tone="primary"
                to="/shifts"
                search={todayShiftsSearch(data.today.date, "filled")}
              />
              <DashboardMetric
                label="Completed"
                value={data.today.completed}
                icon={CheckCircle2}
                tone="success"
                to="/shifts"
                search={todayShiftsSearch(data.today.date, "completed")}
              />
            </div>
            {data.today.cancelled > 0 && (
              <p className="text-sm text-muted-foreground">
                <Link
                  to="/shifts"
                  search={todayShiftsSearch(data.today.date, "cancelled") as any}
                  className="hover:underline"
                >
                  {data.today.cancelled} cancelled
                </Link>{" "}
                today
              </p>
            )}
          </DashboardSection>

          <TodayShiftsSection today={data.today} />

          <Next7DaysSection next7Days={data.next7Days} today={data.today.date} />

          <WorkforceReadinessSection
            documents={data.documents}
            staffReadiness={data.staffReadiness}
          />

          <RecentActivitySection items={data.recentActivity} />
        </>
      )}
    </div>
  );
}
